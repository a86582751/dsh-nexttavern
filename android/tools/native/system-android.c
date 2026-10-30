/* Android additions to the existing native-system binding. The pinned upstream
 * flock.c remains byte-for-byte unchanged; only its registration is composed. */
#include <node_api.h>
#pragma push_macro("NAPI_MODULE_INIT")
#undef NAPI_MODULE_INIT
#define NAPI_MODULE_INIT() static napi_value upstream_flock_init(napi_env env, napi_value exports)
#include "flock.c"
#pragma pop_macro("NAPI_MODULE_INIT")

#include <dlfcn.h>
#include <fcntl.h>
#include <string.h>

#ifndef RENAME_NOREPLACE
#define RENAME_NOREPLACE (1U << 0)
#endif

typedef int (*renameat2_function)(int, const char *, int, const char *, unsigned int);
typedef struct {
  napi_env env;
  napi_ref callback;
  napi_async_work work;
  napi_async_cleanup_hook_handle cleanup;
  char *source;
  char *target;
  int error;
  bool closing;
} publish_request;

static void release_publish(publish_request *request) {
  if (request->callback != NULL) (void)napi_delete_reference(request->env, request->callback);
  if (request->work != NULL) (void)napi_delete_async_work(request->env, request->work);
  if (request->cleanup != NULL) (void)napi_remove_async_cleanup_hook(request->cleanup);
  free(request->source);
  free(request->target);
  free(request);
}
static napi_value publish_setup_error(napi_env env, napi_status status) {
  if (status != napi_pending_exception) {
    (void)napi_throw_error(env, "ERR_ANDROID_PUBLISH_WORK", "Cannot create Android publication work");
  }
  return NULL;
}
static void execute_publish(napi_env env, void *data) {
  (void)env;
  publish_request *request = data;
  // Public Bionic symbol is available from API 30. Never substitute rename(),
  // exists()+write, raw syscall, or a hard link denied by Android policy.
  renameat2_function publish = (renameat2_function)dlsym(RTLD_DEFAULT, "renameat2");
  request->error = publish == NULL ? ENOSYS :
    (publish(AT_FDCWD, request->source, AT_FDCWD, request->target, RENAME_NOREPLACE) == 0 ? 0 : errno);
}
static void complete_publish(napi_env env, napi_status status, void *data) {
  publish_request *request = data;
  if (env != NULL && !request->closing) {
    napi_value callback, receiver, error;
    check_status(status, "Android publication async work did not complete");
    check_status(napi_get_reference_value(env, request->callback, &callback), "Cannot retrieve publication callback");
    check_status(napi_get_undefined(env, &receiver), "Cannot create publication receiver");
    check_status(napi_create_int32(env, request->error, &error), "Cannot create publication errno");
    status = napi_call_function(env, receiver, callback, 1, &error, NULL);
  } else status = napi_ok;
  release_publish(request);
  if (status != napi_pending_exception) check_status(status, "Cannot invoke publication callback");
}
static void cleanup_publish(napi_async_cleanup_hook_handle handle, void *data) {
  (void)handle;
  publish_request *request = data;
  request->closing = true;
  // A running rename cannot be cancelled. Keep owned paths/work alive until
  // its actual completion, even when the Node environment is shutting down.
  (void)napi_cancel_async_work(request->env, request->work);
}
static napi_status copy_path(napi_env env, napi_value value, char **out) {
  size_t length;
  napi_status status = napi_get_value_string_utf8(env, value, NULL, 0, &length);
  if (status != napi_ok) return status;
  *out = malloc(length + 1);
  if (*out == NULL) return napi_generic_failure;
  status = napi_get_value_string_utf8(env, value, *out, length + 1, &length);
  if (status != napi_ok) return status;
  if (length == 0 || (*out)[0] != '/' || strlen(*out) != length) {
    (void)napi_throw_type_error(env, "ERR_INVALID_ARG_VALUE", "Publication requires absolute paths without NUL");
    return napi_pending_exception;
  }
  return napi_ok;
}
static napi_value publish_no_replace(napi_env env, napi_callback_info info) {
  size_t argc = 3;
  napi_value argv[3], name;
  napi_valuetype type;
  napi_status status = napi_get_cb_info(env, info, &argc, argv, NULL, NULL);
  if (status != napi_ok) return publish_setup_error(env, status);
  if (argc != 3 || napi_typeof(env, argv[2], &type) != napi_ok || type != napi_function) {
    (void)napi_throw_type_error(env, "ERR_INVALID_ARG_TYPE", "Expected source, target and callback");
    return NULL;
  }
  publish_request *request = calloc(1, sizeof(*request));
  if (request == NULL) return publish_setup_error(env, napi_generic_failure);
  request->env = env;
  status = copy_path(env, argv[0], &request->source);
  if (status == napi_ok) status = copy_path(env, argv[1], &request->target);
  if (status == napi_ok) status = napi_create_reference(env, argv[2], 1, &request->callback);
  if (status == napi_ok) status = napi_create_string_utf8(env, "publishNoReplace", NAPI_AUTO_LENGTH, &name);
  if (status == napi_ok) status = napi_create_async_work(env, NULL, name, execute_publish, complete_publish, request, &request->work);
  if (status == napi_ok) status = napi_add_async_cleanup_hook(env, cleanup_publish, request, &request->cleanup);
  if (status == napi_ok) status = napi_queue_async_work(env, request->work);
  if (status != napi_ok) { release_publish(request); return publish_setup_error(env, status); }
  return NULL;
}
NAPI_MODULE_INIT() {
  if (upstream_flock_init(env, exports) == NULL) return NULL;
  napi_value function;
  if (napi_create_function(env, "publishNoReplace", NAPI_AUTO_LENGTH, publish_no_replace, NULL, &function) != napi_ok ||
      napi_set_named_property(env, exports, "publishNoReplace", function) != napi_ok) return NULL;
  return exports;
}
