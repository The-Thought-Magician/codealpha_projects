const Api = (() => {
  let cachedUser;

  async function request(path, options = {}) {
    const res = await fetch(`/api${path}`, {
      method: options.method || 'GET',
      headers: options.body ? { 'Content-Type': 'application/json' } : {},
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials: 'same-origin',
    });

    if (res.status === 204) return null;

    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
    return data;
  }

  // Cached because nearly every page asks for it while rendering the header.
  async function currentUser() {
    if (cachedUser !== undefined) return cachedUser;
    try {
      cachedUser = (await request('/me')).user;
    } catch {
      cachedUser = null;
    }
    return cachedUser;
  }

  function setUser(user) {
    cachedUser = user;
  }

  return {
    get: (path) => request(path),
    post: (path, body) => request(path, { method: 'POST', body }),
    currentUser,
    setUser,
  };
})();
