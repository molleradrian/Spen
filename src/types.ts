export interface Client {
  id: string;
  ownerUserID: string;
  companyName: string;
  contactName: string;
  brandDNA: string;
  createdAt?: string;
}

export interface Project {
  id: string;
  ownerUserID: string;
  ownerClientID: string;
  projectName: string;
  status: 'Active' | 'Completed' | 'Archived';
  brief: string;
  createdAt?: string;
}

export interface TaskItem {
  id: string;
  ownerUserID: string;
  ownerProjectID: string;
  taskName: string;
  status: 'To Do' | 'In Progress' | 'Done';
  currentDrawingId?: string;
  createdAt?: string;
}

export interface TaskFile {
  id: string;
  ownerUserID: string;
  ownerTaskID: string;
  fileName: string;
  fileURL: string;
  createdAt?: string;
}

export interface CommentPin {
  id: string;
  ownerUserID: string;
  ownerTaskID: string;
  ownerFileID?: string;
  text: string;
  x: number; // percentage (0 to 100) or canvas pixel
  y: number; // percentage (0 to 100) or canvas pixel
  author: string;
  createdAt?: string;
}

export interface Point {
  x: number;
  y: number;
  pressure: number;
  timestamp: number;
}

export interface Stroke {
  points: Point[];
  color: string;
  width: number;
  mode: 'draw' | 'erase' | 'pencil' | 'marker' | 'airbrush';
}

export interface DrawingLayer {
  id: string;
  name: string;
  strokes: Stroke[];
  visible: boolean;
  opacity: number;
}

export interface DrawingDoc {
  id: string;
  userId: string;
  ownerUserID?: string;
  ownerTaskID?: string;
  title: string;
  dataUrl: string;
  strokes?: string;
  createdAt?: any;
  updatedAt?: any;
}
