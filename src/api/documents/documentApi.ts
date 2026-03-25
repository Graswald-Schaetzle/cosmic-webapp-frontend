import { api } from '../../app/api';

// Document types
export interface DocumentPayload {
  name: string;
  task_id?: number;
  location_id?: string;
  room_id?: number;
}

// Document upload payload
export interface DocumentUploadPayload {
  file: File;
  name: string;
  task_id?: string;
  location_id?: string;
  room_id?: number;
}

// Document update payload
export interface DocumentUpdatePayload {
  file: File;
  name?: string;
  task_id?: string;
  location_id?: string;
  room_id?: number;
}

// Document interface
export interface Document {
  document_id: number;
  name: string;
  created_at: string;
  storage_path: string | null;
  file_signed_url: string | null;
  task_id: number | null;
  location_id: string | null;
  room_id: number | null;
  uploaded_by_user_id: number | null;
}

// New document interface for all_documents endpoint
export interface DocumentItem {
  document_id: number;
  created_at: string;
  name: string;
  task_id: number | null;
  storage_path: string | null;
  room_id: number;
  uploaded_by_user_id: number | null;
  location_id: string | null;
}

export interface Room {
  room_id: number;
  room_name: string;
  documents: DocumentItem[];
  documents_count: number;
}

export interface Floor {
  floor_id: number;
  floor_name: string;
  documents_count: number;
  rooms: Room[];
}

export interface AllDocumentsResponse {
  total_documents: number;
  floors: Floor[];
}

// Upload response type
export interface DocumentUploadResponse {
  data: Document[];
  error: string | null;
}

// Update response type
export interface DocumentUpdateResponse {
  data: Document[];
  error: string | null;
}

// Get document response type
export interface DocumentDetailResponse {
  data: Document;
  error: string | null;
}

// Get documents list response
export interface DocumentListResponse {
  data: Document[];
  error: string | null;
}

// Delete response type
export interface DocumentDeleteResponse {
  data: {};
  error: {};
}

// RTK Query endpoints
export const documentApi = api.injectEndpoints({
  endpoints: builder => ({
    // Get all documents with floor/room structure
    getAllDocuments: builder.query<
      AllDocumentsResponse,
      { floor_id?: number; room_id?: number; location_id?: string }
    >({
      query: params => ({
        url: '/all_documents',
        method: 'GET',
        params,
      }),
      providesTags: ['Documents'],
    }),

    // Get documents list
    getDocuments: builder.query<DocumentListResponse, void>({
      query: () => ({
        url: '/documents',
        method: 'GET',
      }),
      providesTags: ['Documents'],
    }),

    // Get document by ID
    getDocumentById: builder.query<DocumentDetailResponse, string>({
      query: id => ({
        url: `/document/${id}`,
        method: 'GET',
      }),
      providesTags: ['Documents'],
    }),

    // Upload document
    uploadDocument: builder.mutation<DocumentUploadResponse, DocumentUploadPayload>({
      query: payload => ({
        url: '/document',
        method: 'POST',
        isFormData: true,
        body: payload,
      }),
      invalidatesTags: ['Documents'],
    }),

    // Update document
    updateDocument: builder.mutation<
      DocumentUpdateResponse,
      { id: string; payload: DocumentUpdatePayload }
    >({
      query: ({ id, payload }) => ({
        url: `/document/${id}`,
        method: 'PUT',
        isFormData: true,
        body: payload,
      }),
      invalidatesTags: ['Documents'],
    }),

    // Delete document
    deleteDocument: builder.mutation<DocumentDeleteResponse, string>({
      query: id => ({
        url: `/document/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Documents'],
    }),
  }),
});

export const {
  useGetDocumentsQuery,
  useGetAllDocumentsQuery,
  useGetDocumentByIdQuery,
  useUploadDocumentMutation,
  useUpdateDocumentMutation,
  useDeleteDocumentMutation,
} = documentApi;
