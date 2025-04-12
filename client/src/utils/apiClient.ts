// client/src/utils/apiClient.ts

const API_BASE_URL = 'http://localhost:5000'; // Or relative '/api'

/**
 * A wrapper around the native fetch function that automatically adds the
 * Authorization header with the JWT token from localStorage if available.
 *
 * @param endpoint The API endpoint (e.g., '/api/sessions')
 * @param options Standard fetch options (method, headers, body, etc.)
 * @returns A Promise resolving to the Fetch Response object.
 * @throws {Error} Throws an error if the fetch fails or the response is not ok,
 * including the status text and potentially a message from the response body.
 */
export const authenticatedFetch = async (
    endpoint: string,
    options: RequestInit = {}
): Promise<Response> => {
    const token = localStorage.getItem('authToken');
    const url = `${API_BASE_URL}${endpoint}`; // Construct full URL

    // Ensure headers object exists
    const headers = new Headers(options.headers || {});

    // Add Authorization header if token exists
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    // Ensure Content-Type is set for methods that typically have a body
    if (options.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json'); // Default to JSON
    }

    try {
        const response = await fetch(url, {
            ...options, // Spread existing options (method, body, etc.)
            headers: headers, // Add the potentially modified headers
        });

        // If response is not ok (status code 200-299), try to parse error and throw
        if (!response.ok) {
            let errorPayload: { message?: string } = {};
            try {
                // Try to get error message from response body
                errorPayload = await response.json();
            } catch (parseError) {
                // Ignore if response body isn't valid JSON
            }
            // Throw an error including status and message from backend if available
            throw new Error(errorPayload?.message || `HTTP error! Status: ${response.status} ${response.statusText}`);
        }

        // Return the successful response object for the caller to handle
        return response;

    } catch (error) {
        console.error(`API call failed: ${options.method || 'GET'} ${endpoint}`, error);
        // Re-throw the error so the calling component can handle it (e.g., show message to user)
        throw error;
    }
};

// Example Usage (within another component/function):
/*
async function saveMyData(data) {
    try {
        const response = await authenticatedFetch('/api/my-protected-route', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        const result = await response.json();
        console.log("Success:", result);
    } catch (error) {
        console.error("Failed to save data:", error.message);
        // Update UI to show error message
    }
}
*/