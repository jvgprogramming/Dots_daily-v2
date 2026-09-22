import 'dart:convert';
import 'dart:io' show Platform;
import 'package:http/http.dart' as http;

class ApiException implements Exception {
  final String message;
  final int statusCode;
  final Map<String, dynamic>? errors;

  ApiException(this.message, this.statusCode, [this.errors]);

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
          response = await http.get(uri, headers: _headers(withAuth: withAuth));
          break;
        case 'POST':
          response = await http.post(
            uri,
            headers: _headers(withAuth: withAuth),
            body: body != null ? jsonEncode(body) : null,
          );
          break;
        case 'PUT':
          response = await http.put(
            uri,
            headers: _headers(withAuth: withAuth),
            body: body != null ? jsonEncode(body) : null,
          );
          break;
        case 'DELETE':
          response = await http.delete(
            uri,
            headers: _headers(withAuth: withAuth),
          );
          break;
        default:
          throw ApiException('Unsupported method: $method', 0);
      }
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException('Network error: Could not reach server. ($e)', 0);
    }

    final data = jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(
        (data['message'] as String?) ?? 'An error occurred',
        response.statusCode,
        data['errors'] as Map<String, dynamic>?,
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
}
