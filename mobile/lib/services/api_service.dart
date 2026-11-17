import 'dart:async';
import 'dart:convert';
import 'dart:io' show File, Platform;
import 'package:http/http.dart' as http;

class ApiException implements Exception {
  final String message;
  final int statusCode;
  final Map<String, dynamic>? errors;

  /// Machine-readable reason the server gave (`data.reason`), e.g.
  /// `activation_required`, so the app can react instead of just showing text.
  final String? reason;

  /// Extra numbers the server sent with the error (`data`), e.g. `resend_in`.
  final Map<String, dynamic>? data;

  ApiException(this.message, this.statusCode, [this.errors, this.data])
      : reason = data?['reason'] as String?;

  /// The most useful line to show the user: the first field-validation error
  /// (e.g. "The provided credentials are incorrect.") when there is one,
  /// otherwise the top-level message (which is often just "Validation failed.").
  String get displayMessage {
    final fieldErrors = errors;
    if (fieldErrors != null && fieldErrors.isNotEmpty) {
      final first = fieldErrors.values.first;
      if (first is List && first.isNotEmpty) return first.first.toString();
      if (first is String) return first;
    }
    return message;
  }

  @override
  String toString() => message;
}

class ApiService {
  /// Private so there can only ever be one client: the auth token lives on the
  /// instance, so a second instance would authenticate nothing and quietly drop
  /// every dose write. Use [shared].
  ApiService._();

  /// The instance every provider talks to.
  ///
  /// Auth, dose logs and the regimen all share one token, so they must share one
  /// client — otherwise a dose logged from the app would be sent unauthenticated.
  static final ApiService shared = ApiService._();

  /// Default backend URL based on the current platform. Only used when
  /// `API_BASE_URL` is not supplied via `--dart-define`.
  /// - Android emulator uses 10.0.2.2 (special alias for host machine's localhost).
  /// - iOS simulator uses 127.0.0.1 (localhost).
  /// - Real devices: pass `--dart-define=API_BASE_URL=...` with either the host
  ///   machine's LAN IP, or `http://127.0.0.1:8000/api/v1` combined with
  ///   `adb reverse tcp:8000 tcp:8000`.
  static String get defaultBaseUrl {
    try {
      if (Platform.isAndroid) {
        return 'http://10.0.2.2:8000/api/v1';
      }
      if (Platform.isIOS) {
        return 'http://127.0.0.1:8000/api/v1';
      }
    } catch (_) {
      // Platform not available (e.g. web or unit tests)
    }
    return 'http://127.0.0.1:8000/api/v1';
  }

  /// Value of the `API_BASE_URL` dart-define, e.g.
  /// `flutter run --dart-define=API_BASE_URL=http://127.0.0.1:8000/api/v1`.
  /// Empty when the define is not supplied.
  static const String _configuredBaseUrl = String.fromEnvironment('API_BASE_URL');

  /// The base URL to use: the `API_BASE_URL` dart-define when supplied,
  /// otherwise the per-platform [defaultBaseUrl]. A trailing slash is ignored.
  static String get resolvedBaseUrl => _stripTrailingSlash(
        _configuredBaseUrl.isNotEmpty ? _configuredBaseUrl : defaultBaseUrl,
      );

  /// The active base URL. Defaults to [resolvedBaseUrl], and can also be changed
  /// at runtime to point at a different server.
  String baseUrl = resolvedBaseUrl;

  static String _stripTrailingSlash(String url) =>
      url.endsWith('/') ? url.substring(0, url.length - 1) : url;

  String? _token;

  String? get token => _token;

  void setToken(String? token) {
    _token = token;
  }

  Map<String, String> _headers({bool withAuth = true}) {
    final headers = <String, String>{
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };
    if (withAuth && _token != null) {
      headers['Authorization'] = 'Bearer $_token';
    }
    return headers;
  }

  /// How long to wait for a normal JSON request before giving up. Without this
  /// a request to an unreachable server hangs for the OS default (often a
  /// minute or more), which reads to the user as "stuck loading" — so a wrong
  /// password or an unreachable backend now fails in seconds with a clear error.
  static const Duration _timeout = Duration(seconds: 15);

  Future<Map<String, dynamic>> _request(
    String method,
    String path, {
    Map<String, dynamic>? body,
    bool withAuth = true,
  }) async {
    final uri = Uri.parse('$baseUrl$path');

    late http.Response response;

    try {
      switch (method) {
        case 'GET':
          response = await http
              .get(uri, headers: _headers(withAuth: withAuth))
              .timeout(_timeout);
          break;
        case 'POST':
          response = await http
              .post(
                uri,
                headers: _headers(withAuth: withAuth),
                body: body != null ? jsonEncode(body) : null,
              )
              .timeout(_timeout);
          break;
        case 'PUT':
          response = await http
              .put(
                uri,
                headers: _headers(withAuth: withAuth),
                body: body != null ? jsonEncode(body) : null,
              )
              .timeout(_timeout);
          break;
        case 'DELETE':
          response = await http
              .delete(uri, headers: _headers(withAuth: withAuth))
              .timeout(_timeout);
          break;
        default:
          throw ApiException('Unsupported method: $method', 0);
      }
    } on TimeoutException {
      throw ApiException(
        'The server took too long to respond. Check your connection and that '
        'the server is running.',
        0,
      );
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException('Network error: Could not reach server. ($e)', 0);
    }

    final data = jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final extra = data['data'];
      throw ApiException(
        (data['message'] as String?) ?? 'An error occurred',
        response.statusCode,
        data['errors'] as Map<String, dynamic>?,
        extra is Map<String, dynamic> ? extra : null,
      );
    }

    return data;
  }

  Future<Map<String, dynamic>> get(String path) => _request('GET', path);

  Future<Map<String, dynamic>> post(
    String path, {
    Map<String, dynamic>? body,
    bool withAuth = true,
  }) => _request('POST', path, body: body, withAuth: withAuth);

  Future<Map<String, dynamic>> put(String path, {Map<String, dynamic>? body}) =>
      _request('PUT', path, body: body);

  Future<Map<String, dynamic>> delete(String path) => _request('DELETE', path);

  /// POST a `multipart/form-data` request with scalar [fields] and one file.
  ///
  /// Used to upload a VOT proof (video or photo). We do NOT set
  /// `Content-Type` ourselves — `MultipartRequest` sets it with the correct
  /// multipart boundary — but we keep the same `Accept` + bearer auth and parse
  /// the identical `{ success, message, data }` envelope as [_request].
  ///
  /// [onProgress] receives 0.0–1.0 as the file is streamed out. `http` has no
  /// upload progress of its own, so the file is wrapped in a stream that counts
  /// the bytes handed to the socket.
  Future<Map<String, dynamic>> postMultipart(
    String path, {
    required Map<String, dynamic> fields,
    required String filePath,
    String fileField = 'media',
    bool withAuth = true,
    void Function(double progress)? onProgress,
  }) async {
    final uri = Uri.parse('$baseUrl$path');

    late http.Response response;

    try {
      final request = http.MultipartRequest('POST', uri);
      request.headers['Accept'] = 'application/json';
      if (withAuth && _token != null) {
        request.headers['Authorization'] = 'Bearer $_token';
      }

      fields.forEach((key, value) {
        if (value != null) request.fields[key] = value.toString();
      });

      final file = File(filePath);
      final total = await file.length();
      var sent = 0;
      final counted = file.openRead().map((chunk) {
        sent += chunk.length;
        if (onProgress != null && total > 0) onProgress(sent / total);
        return chunk;
      });
      request.files.add(http.MultipartFile(
        fileField,
        counted,
        total,
        filename: filePath.split(Platform.pathSeparator).last,
      ));

      // Video uploads need a much longer ceiling than a plain JSON request.
      final streamed = await request.send().timeout(const Duration(minutes: 5));
      response = await http.Response.fromStream(streamed);
    } on TimeoutException {
      throw ApiException(
        'The upload took too long. Check your connection and try again.',
        0,
      );
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException('Network error: Could not reach server. ($e)', 0);
    }

    // A web server limit (e.g. 413 Request Entity Too Large) answers with an
    // HTML page, not our JSON envelope.
    Map<String, dynamic> data;
    try {
      data = jsonDecode(response.body) as Map<String, dynamic>;
    } catch (_) {
      throw ApiException(
        response.statusCode == 413
            ? 'The file is too large for the server. Please record a shorter video.'
            : 'The server could not process the upload (error ${response.statusCode}).',
        response.statusCode,
      );
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(
        (data['message'] as String?) ?? 'An error occurred',
        response.statusCode,
        data['errors'] as Map<String, dynamic>?,
      );
    }

    return data;
  }
}
