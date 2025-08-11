class OSSClient {
  constructor(baseUrl = 'http://localhost:8081') {
    this.baseUrl = baseUrl;
    this.RETRY_MAX = 3;
    this.CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB as suggested in the reference
    this.BATCH_SIZE = 5; // how many upload URLs are requested at a time
    this.keepTrying = true;
  }

  async uploadFile(file, options = {}) {
    const {
      onProgress = () => {},
      uploadInParallel = false
    } = options;

    try {
      console.log(`Starting upload for: ${file.name} (${file.size} bytes)`);
      
      const stepsMax = Math.ceil(file.size / this.CHUNK_SIZE);
      const finishedChunks = new Set();
      let uploadKey;

      // Progress callback wrapper
      const updateProgress = (state, message) => {
        const percentage = state === 'success' ? 100 : 
                         Math.ceil((finishedChunks.size / stepsMax) * 90);
        
        onProgress({
          state,
          loaded: Math.floor((file.size * percentage) / 100),
          total: file.size,
          percentage,
          message
        });
      };

      // Upload batches of chunks
      for (let step = 0; step < stepsMax; step += this.BATCH_SIZE) {
        let retryCount = 0;
        
        while (true) {
          try {
            const count = Math.min(stepsMax - step, this.BATCH_SIZE);
            uploadKey = await this.uploadBatchAsync(
              file, 
              step, 
              count, 
              uploadKey, 
              finishedChunks,
              stepsMax,
              updateProgress,
              uploadInParallel
            );
            break;
          } catch (error) {
            console.error(`Batch upload failed (attempt ${retryCount + 1}):`, error);
            
            if (this.keepTrying && retryCount++ < this.RETRY_MAX) {
              console.log(`Retrying in ${retryCount * 5} seconds...`);
              await new Promise(resolve => setTimeout(resolve, retryCount * 5000));
            } else {
              updateProgress('failed', 'Upload failed');
              throw new Error(`Upload failed after ${this.RETRY_MAX} retries: ${error.message}`);
            }
          }
        }
      }

      // Complete the upload
      updateProgress('inprogress', 'Finalizing upload...');
      const result = await this.completeUpload(file.name, uploadKey);
      
      if (result.status === "error") {
        updateProgress('failed', 'Upload completion failed');
        throw new Error('Upload completion failed');
      } else {
        updateProgress('success', 'Upload completed successfully!');
        
        return {
          success: true,
          objectKey: result.objectKey || file.name,
          name: file.name,
          size: file.size,
          url: result.location,
          urn: result.objectId ? this.urnify(result.objectId) : null,
          uploadKey
        };
      }

    } catch (error) {
      console.error('Upload failed:', error);
      throw error;
    }
  }

  async uploadBatchAsync(file, step, count, uploadKey, finishedChunks, stepsMax, updateProgress, uploadInParallel) {
    console.log(`uploadBatchAsync: step=${step}, count=${count}, uploadKey=${uploadKey}`);
    
    try {
      // Get signed URLs for this batch - using the index + 1 as per API requirement
      const urlsResponse = await this.getUploadUrls(file.name, count, step + 1, uploadKey);
      console.log('Full URLs response:', urlsResponse);
      
      if (!urlsResponse || !urlsResponse.urls || !Array.isArray(urlsResponse.urls)) {
        throw new Error(`Invalid response structure: ${JSON.stringify(urlsResponse)}`);
      }
      
      uploadKey = urlsResponse.uploadKey;

      const promises = [];
      
      for (let index = 0; index < count; index++) {
        const chunkIndex = step + index;
        const start = chunkIndex * this.CHUNK_SIZE;
        const end = Math.min(start + this.CHUNK_SIZE, file.size);
        
        if (!urlsResponse.urls[index]) {
          throw new Error(`Missing URL for index ${index} in response: ${JSON.stringify(urlsResponse.urls)}`);
        }
        
        const uploadPromise = this.uploadChunkAsync(
          file, 
          start, 
          end, 
          urlsResponse.urls[index], 
          finishedChunks,
          () => {
            const progressMsg = `Uploading... ${finishedChunks.size}/${stepsMax} chunks`;
            updateProgress('inprogress', progressMsg);
          }
        );

        promises.push(uploadPromise);
        
        // If not uploading in parallel, wait for each chunk
        if (!uploadInParallel) {
          await uploadPromise;
        }
      }

      // If uploading in parallel, wait for all chunks in this batch
      if (uploadInParallel) {
        await Promise.all(promises);
      }

      return uploadKey;
    } catch (error) {
      console.error('Batch upload failed:', error);
      throw error;
    }
  }

  async uploadChunkAsync(file, start, end, signedUrl, finishedChunks, onChunkComplete) {
    console.log(`uploadChunkAsync: ${start} - ${end}`);
    
    // Skip if already uploaded
    if (finishedChunks.has(start)) {
      return 200;
    }

    try {
      // Read the chunk
      const chunkData = await this.readChunkAsync(file, start, end);
      
      // Upload the chunk
      console.log(`Uploading chunk to: ${signedUrl.substring(0, 50)}...`);
      const response = await fetch(signedUrl, {
        method: 'PUT',
        body: chunkData
      });

      if (response.status !== 200) {
        throw new Error(`Chunk upload failed: ${response.status} ${response.statusText}`);
      }

      // Mark chunk as completed
      finishedChunks.add(start);
      onChunkComplete();
      
      return 200;
    } catch (error) {
      console.error(`Chunk upload failed (${start}-${end}):`, error);
      throw error;
    }
  }

  async readChunkAsync(file, start, end) {
    return new Promise((resolve, reject) => {
      console.log(`readChunkAsync: ${start} - ${end}`);
      
      const reader = new FileReader();
      const blob = file.slice(start, end);

      reader.onload = function(e) {
        resolve(reader.result);
      };

      reader.onerror = function(e) {
        reject(new Error('Failed to read file chunk'));
      };

      reader.readAsArrayBuffer(blob);
    });
  }

  async getUploadUrls(objectName, count, startIndex = 1, uploadKey = null) {
    try {
      // Build URL following the pattern from the script
      // Don't hardcode bucket name, let the backend use its configured bucket
      let url = `/dm/uploadurls?objectName=${encodeURIComponent(objectName)}&index=${startIndex}&count=${count}`;
      
      if (uploadKey) {
        url += `&uploadKey=${encodeURIComponent(uploadKey)}`;
      }

      // Use baseUrl for the fetch call
      const fullUrl = `${this.baseUrl}${url}`;
      console.log(`Getting upload URLs: ${fullUrl}`);
      
      const response = await fetch(fullUrl, {
        method: 'GET'
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Upload URLs request failed: ${response.status} - ${errorText}`);
        throw new Error(`Failed to get upload URLs: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Received upload URLs response:', data);
      
      // Validate response structure
      if (!data || typeof data !== 'object') {
        throw new Error(`Invalid response format: expected object, got ${typeof data}`);
      }
      
      if (!data.urls || !Array.isArray(data.urls)) {
        throw new Error(`Invalid response: missing or invalid 'urls' array. Response: ${JSON.stringify(data)}`);
      }
      
      if (data.urls.length !== count) {
        console.warn(`Expected ${count} URLs, got ${data.urls.length}`);
      }
      
      return data;
    } catch (error) {
      console.error('Error getting upload URLs:', error);
      throw error;
    }
  }

  async completeUpload(objectName, uploadKey) {
    try {
      console.log(`Completing upload for: ${objectName} with uploadKey: ${uploadKey}`);
      
      // Build URL following the pattern from the script
      // Don't hardcode bucket name, let the backend use its configured bucket
      const url = `/dm/uploadurls?objectName=${encodeURIComponent(objectName)}`;
      const fullUrl = `${this.baseUrl}${url}`;
      
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uploadKey
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to complete upload: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Upload completed:', result);
      
      return result;
    } catch (error) {
      console.error('Error completing upload:', error);
      throw error;
    }
  }

  // Stop trying to upload (for cancellation)
  cancelUpload() {
    this.keepTrying = false;
  }

  // Resume upload attempts
  resumeUpload() {
    this.keepTrying = true;
  }

  // Utility function to create URN from object ID (browser-compatible)
  urnify(objectId) {
    // Use browser's btoa instead of Buffer for base64 encoding
    return btoa(objectId).replace(/=/g, '');
  }

  // Calculate optimal number of parts based on file size
  calculateParts(fileSize) {
    return Math.ceil(fileSize / this.CHUNK_SIZE);
  }

  // Format file size for display
  formatFileSize(bytes) {
    if (!bytes || bytes === 0) return 'Unknown size';
    
    const kb = bytes / 1024;
    const mb = bytes / (1024 * 1024);
    const gb = bytes / (1024 * 1024 * 1024);
    
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    if (mb >= 1) return `${mb.toFixed(2)} MB`;
    if (kb >= 1) return `${kb.toFixed(2)} KB`;
    return `${bytes} bytes`;
  }
}

export default OSSClient;