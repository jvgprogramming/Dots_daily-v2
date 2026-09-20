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
  /// Default backend URL based on the current platform.
  /// - Android emulator uses 10.0.2.2 (special alias for host machine's localhost).
  /// - iOS simulator uses 127.0.0.1 (localhost).
  /// - Real devices use the host machine's LAN IP (override via [defaultBaseUrl]).
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

  /// The active base URL. Change this at runtime to point to a different server.
  /// naga change ang ip depende kung din naka connect
  String baseUrl = 'http://10.200.132.10:8000/api/v1';

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
