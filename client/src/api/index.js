import axios from 'axios';

const api = axios.create({ baseURL: 'http://localhost:3001/api' });

export const getProblems = (filters = {}) => api.get('/problems', { params: filters });
export const getProblem = (id) => api.get(`/problems/${id}`);
export const addRecord = (id, data) => api.post(`/problems/${id}/records`, data);
export const updateLatest = (id, data) => api.patch(`/problems/${id}/latest`, data);
export const updateTags = (id, tags) => api.put(`/problems/${id}/tags`, { tags });
export const getStats = () => api.get('/stats');
export const getHeatmap = () => api.get('/heatmap');
export const getRandom = (filters = {}) => api.get('/random', { params: filters });
export const getTags = () => api.get('/tags');
export const deleteRecord = (recordId) => api.delete(`/records/${recordId}`);

// ── 收藏夹 ────────────────────────────────────────────────
export const getFavorites = () => api.get('/favorites');
export const createFavorite = (name) => api.post('/favorites', { name });
export const renameFavorite = (id, name) => api.put(`/favorites/${id}`, { name });
export const deleteFavorite = (id) => api.delete(`/favorites/${id}`);
export const addProblemToFavorite = (problemId, favoriteId) =>
  api.post(`/problems/${problemId}/favorites/${favoriteId}`);
export const removeProblemFromFavorite = (problemId, favoriteId) =>
  api.delete(`/problems/${problemId}/favorites/${favoriteId}`);

// ── 笔记 ──────────────────────────────────────────────────
export const getNotes = (search = '') => api.get('/notes', { params: search ? { search } : {} });
export const getNote = (id) => api.get(`/notes/${id}`);
export const createNote = (data) => api.post('/notes', data);
export const updateNote = (id, data) => api.put(`/notes/${id}`, data);
export const moveNote = (id, parent_id) => api.patch(`/notes/${id}/move`, { parent_id });
export const deleteNote = (id) => api.delete(`/notes/${id}`);

export const uploadImage = (file) => {
  const form = new FormData();
  form.append('image', file);
  return api.post('/upload', form);
};
