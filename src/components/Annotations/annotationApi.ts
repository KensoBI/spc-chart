import { getBackendSrv } from '@grafana/runtime';
import { CreateAnnotationPayload, CreateAnnotationResponse, UpdateAnnotationPayload } from './types';

export async function createAnnotation(
  payload: CreateAnnotationPayload
): Promise<CreateAnnotationResponse> {
  return getBackendSrv().post('/api/annotations', payload);
}

export async function updateAnnotation(id: number, payload: UpdateAnnotationPayload): Promise<void> {
  return getBackendSrv().patch(`/api/annotations/${id}`, payload);
}

export async function deleteAnnotation(id: number): Promise<void> {
  return getBackendSrv().delete(`/api/annotations/${id}`);
}
