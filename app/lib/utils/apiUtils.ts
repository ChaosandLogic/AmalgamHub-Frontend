/**
 * API utility functions for error handling and response parsing
 */

/**
 * Parse error message from a fetch Response object
 * Attempts to extract a meaningful error message from the response body
 * 
 * @param response - The fetch Response object
 * @param defaultMessage - Default error message if parsing fails
 * @returns Promise<string> - The parsed error message
 */
export async function parseErrorResponse(
  response: Response,
  defaultMessage: string
): Promise<string> {
  let errorMessage = defaultMessage;
  
  try {
    const errorText = await response.text();
    if (errorText) {
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.message || errorMessage;
      } catch {
        // If JSON parsing fails, use the raw text
        errorMessage = errorText || errorMessage;
      }
    }
  } catch (e) {
    console.error('Error parsing error response:', e);
  }
  
  return errorMessage;
}

/**
 * Handle API errors with consistent logging and error extraction
 * 
 * @param response - The fetch Response object
 * @param defaultMessage - Default error message
 * @param context - Context for logging (e.g., 'creating booking')
 * @returns Promise<Error> - An Error object with the parsed message
 */
export async function handleApiError(
  response: Response,
  defaultMessage: string,
  context: string
): Promise<Error> {
  const errorMessage = await parseErrorResponse(response, defaultMessage);
  console.error(`Failed to ${context}:`, { 
    status: response.status, 
    message: errorMessage 
  });
  return new Error(errorMessage);
}





