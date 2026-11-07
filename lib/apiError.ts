export type ApiErrorKind = 'network' | 'auth' | 'permission' | 'notFound' | 'server';

export interface ApiErrorInfo {
  kind: ApiErrorKind;
  /** HTTP status, when the server answered. */
  status?: number;
  /** User-facing Arabic message. */
  message: string;
  /** Raw server message (Frappe exception text), for display under the main message. */
  detail?: string;
}

/** Extracts the most descriptive message from a Frappe error response body. */
export function frappeMessage(data: any): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  if (data._server_messages) {
    try {
      const msgs = JSON.parse(data._server_messages);
      const text = msgs
        .map((m: any) => {
          try {
            const parsed = typeof m === 'string' ? JSON.parse(m) : m;
            return parsed.message ?? String(parsed);
          } catch {
            return String(m);
          }
        })
        .join('\n')
        .replace(/<[^>]+>/g, '');
      if (text) return text;
    } catch {}
  }
  if (typeof data.message === 'string') return data.message;
  if (data.exception) return String(data.exception);
  if (data.exc_type) return String(data.exc_type);
  return undefined;
}

/** Classifies an axios/Frappe error so the UI can say what actually went wrong. */
export function describeApiError(err: any): ApiErrorInfo {
  const status: number | undefined = err?.response?.status;
  const detail = frappeMessage(err?.response?.data);

  if (!err?.response) {
    return { kind: 'network', message: 'تعذر الاتصال بالخادم. تحقق من الاتصال بالإنترنت.' };
  }
  if (status === 401) {
    return { kind: 'auth', status, detail, message: 'انتهت الجلسة. يرجى تسجيل الدخول مجدداً.' };
  }
  if (status === 403) {
    return { kind: 'permission', status, detail, message: 'ليس لديك صلاحية لعرض هذه البيانات.' };
  }
  if (status === 429) {
    return {
      kind: 'server',
      status,
      detail,
      message: 'طلبات كثيرة. يرجى الانتظار قليلاً ثم المحاولة.',
    };
  }
  if (status === 404) {
    return { kind: 'notFound', status, detail, message: 'لم يتم العثور على البيانات المطلوبة.' };
  }
  return { kind: 'server', status, detail, message: `حدث خطأ في الخادم (${status}).` };
}
