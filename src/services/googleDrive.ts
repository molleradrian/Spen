// Google Drive REST API v3 Integration Service

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  thumbnailLink?: string;
  iconLink?: string;
}

const APP_FOLDER_NAME = 'S-Pen Canvas Drawings';

/**
 * Clean helper to handle API errors
 */
async function handleResponse(response: Response, errorMessage: string) {
  if (!response.ok) {
    let detail = '';
    try {
      const errJson = await response.json();
      detail = errJson.error?.message || JSON.stringify(errJson);
    } catch {
      detail = await response.text();
    }
    throw new Error(`${errorMessage}: ${detail || response.statusText}`);
  }
  return response.json();
}

/**
 * Retrieve or create a dedicated application folder to keep the user's Drive organized.
 */
export async function getOrCreateAppFolder(accessToken: string): Promise<string> {
  // 1. Search for existing folder
  const query = encodeURIComponent(`name = '${APP_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`;
  
  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  
  const searchData = await handleResponse(searchRes, 'Failed to search Google Drive folders');
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // 2. Folder does not exist, create it
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: APP_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder'
    })
  });

  const createData = await handleResponse(createRes, 'Failed to create application folder on Google Drive');
  return createData.id;
}

/**
 * Upload active sketch JSON workspace files to Google Drive.
 * Supports overwrite/updates if existingFileId is supplied.
 */
export async function saveDrawingToDrive(
  accessToken: string,
  filename: string,
  layers: any,
  dataUrl: string,
  existingFileId?: string
): Promise<{ id: string; name: string }> {
  // Ensure we append the proper extension
  const safeFilename = filename.endsWith('.s_drawing.json') ? filename : `${filename}.s_drawing.json`;
  
  // Package drawing workspace structure
  const workspaceContent = JSON.stringify({
    version: '1.0.0',
    type: 's_drawing_workspace',
    layers,
    previewUrl: dataUrl,
    exportedAt: new Date().toISOString()
  });

  const folderId = await getOrCreateAppFolder(accessToken);
  const boundary = 'spen_canvas_boundary_json';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: safeFilename,
    mimeType: 'application/json',
    ...(existingFileId ? {} : { parents: [folderId] })
  };

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    workspaceContent +
    closeDelimiter;

  const url = existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

  const method = existingFileId ? 'PATCH' : 'POST';

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartRequestBody
  });

  const result = await handleResponse(response, `Failed to save workspace drawing to Google Drive`);
  return { id: result.id, name: result.name };
}

/**
 * Export high-quality drawing flattened images (PNG) to Google Drive.
 */
export async function savePngToDrive(
  accessToken: string,
  filename: string,
  dataUrl: string
): Promise<{ id: string; name: string }> {
  const safeFilename = filename.endsWith('.png') ? filename : `${filename}.png`;
  
  // Extract base64 segment from PNG Data URL
  const base64Content = dataUrl.split(',')[1];
  
  // Convert base64 string to a Uint8Array blob
  const byteCharacters = atob(base64Content);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'image/png' });

  const folderId = await getOrCreateAppFolder(accessToken);
  const boundary = 'spen_canvas_boundary_png';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: safeFilename,
    mimeType: 'image/png',
    parents: [folderId]
  };

  // Convert blob to binary representation inside multipart boundary
  const arrayBuffer = await blob.arrayBuffer();
  const metadataPart = encoder().encode(
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: image/png\r\n\r\n'
  );
  const footerPart = encoder().encode(closeDelimiter);

  const bodyBuffer = new Uint8Array(metadataPart.byteLength + arrayBuffer.byteLength + footerPart.byteLength);
  bodyBuffer.set(new Uint8Array(metadataPart), 0);
  bodyBuffer.set(new Uint8Array(arrayBuffer), metadataPart.byteLength);
  bodyBuffer.set(new Uint8Array(footerPart), metadataPart.byteLength + arrayBuffer.byteLength);

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: bodyBuffer
  });

  const result = await handleResponse(response, `Failed to export PNG drawing to Google Drive`);
  return { id: result.id, name: result.name };
}

// Lazy TextEncoder helper for ES module safety
function encoder() {
  return new TextEncoder();
}

/**
 * Retrieve list of drawing works (.s_drawing.json) and companion files inside the custom application folder.
 */
export async function listDrawingsFromDrive(
  accessToken: string,
  searchQuery = ''
): Promise<GoogleDriveFile[]> {
  try {
    const folderId = await getOrCreateAppFolder(accessToken);
    
    let querySegments = `('${folderId}' in parents or name contains '.s_drawing.json' or name contains '.png') and trashed = false`;
    if (searchQuery.trim()) {
      const sanitizedSearch = searchQuery.replace(/'/g, "\\'");
      querySegments += ` and name contains '${sanitizedSearch}'`;
    }

    const fields = 'files(id,name,mimeType,modifiedTime,size,thumbnailLink,iconLink)';
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(querySegments)}&orderBy=modifiedTime desc&fields=${encodeURIComponent(fields)}`;
    
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    const data = await handleResponse(response, 'Failed to fetch items from Google Drive');
    return data.files || [];
  } catch (err) {
    console.error('Error during listDrawingsFromDrive: ', err);
    throw err;
  }
}

/**
 * Downloads workspace details and parses drawing file components.
 */
export async function downloadFileContent(accessToken: string, fileId: string): Promise<any> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error(`Failed to download drawing content from Google Drive: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Delete a specific drawing file from Google Drive.
 */
export async function deleteDriveFile(accessToken: string, fileId: string): Promise<boolean> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;
  
  const response = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error(`Failed to delete file from Google Drive: ${response.statusText}`);
  }

  return true;
}
