const sb = require('../config/supabase');

class BaseRepository {
  constructor(table) {
    this.table = table;
  }

  request(path, options) {
    return sb(path, options);
  }

  find(query = 'select=*') {
    const separator = query.startsWith('?') ? '' : '?';
    return this.request(`/${this.table}${separator}${query}`);
  }

  findAll(select = '*') {
    return this.request(`/${this.table}?select=${select}`);
  }

  findById(id, select = '*') {
    return this.request(`/${this.table}?id=eq.${id}&select=${select}`);
  }

  create(payload, options = {}) {
    return this.request(`/${this.table}`, {
      method: 'POST',
      body: JSON.stringify(payload),
      ...options,
    });
  }

  updateById(id, payload, options = {}) {
    return this.request(`/${this.table}?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
      ...options,
    });
  }
}

module.exports = BaseRepository;
