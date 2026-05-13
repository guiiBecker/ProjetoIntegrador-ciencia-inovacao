export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

export function apiUrl(path) {
	return `${API_URL}${path}`;
}

export async function apiFetch(path, options = {}) {
	return fetch(apiUrl(path), {
		credentials: 'include',
		...options,
		headers: {
			...(options.headers || {}),
		},
	});
}

export async function apiJson(path, options = {}) {
	const response = await apiFetch(path, options);
	const data = await response.json().catch(() => null);
	if (!response.ok) {
		const error = new Error(data?.message || 'Erro na requisicao');
		error.status = response.status;
		error.data = data;
		throw error;
	}
	return data;
}
