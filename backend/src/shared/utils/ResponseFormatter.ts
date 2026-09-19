/**
 * Standard response shaper — mirrors api-monitoring-system responseFormatter.js.
 */
const ResponseFormatter = {
  success<T>(data: T, message: string = 'Success', statusCode: number = 200) {
    return { success: true, statusCode, message, data };
  },

  error(message: string = 'An error occurred', statusCode: number = 500) {
    return { success: false, statusCode, message };
  },

  paginated<T>(
    data: T[],
    page: number,
    limit: number,
    total: number,
    message: string = 'Success'
  ) {
    return {
      success: true,
      statusCode: 200,
      message,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },
};

export default ResponseFormatter;
