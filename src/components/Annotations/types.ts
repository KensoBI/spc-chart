export interface CreateAnnotationPayload {
  text: string;
  time: number; // Unix timestamp in milliseconds
  tags?: string[];
  dashboardUID?: string;
  panelId?: number;
}

export interface CreateAnnotationResponse {
  message: string;
  id: number;
}

export interface UpdateAnnotationPayload {
  text?: string;
  tags?: string[];
  time?: number;
  timeEnd?: number;
}
