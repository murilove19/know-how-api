const BaseRepository = require('./BaseRepository');

class ProfileRepository extends BaseRepository {
  constructor() {
    super('profiles');
  }

  findByLogin(login, select = '*') {
    const isEmail = login.includes('@');
    const field = isEmail ? 'email' : 'ra';
    return this.request(`/profiles?${field}=eq.${encodeURIComponent(login)}&select=${select}`);
  }

  findByRole(role) {
    return this.request(`/profiles?role=eq.${role}&select=*`);
  }

  findByRoleAndCourse(role, courseId, select = '*') {
    return this.request(`/profiles?role=eq.${role}&curso_id=eq.${courseId}&select=${select}`);
  }

  findStudentByRa(ra) {
    return this.request(`/profiles?ra=eq.${encodeURIComponent(ra)}&role=eq.aluno&select=*`);
  }
}

module.exports = new ProfileRepository();
