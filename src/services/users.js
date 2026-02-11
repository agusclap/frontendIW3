import { api } from "./api";

export const UsersService = {
  async list() {
    const { data } = await api.get("/user");
    return data;
  },

  async search(usernameOrEmail) { // Cambiamos el nombre del argumento para ser claros
    const { data } = await api.get("/user/search", {
      params: { usernameOrEmail: usernameOrEmail || undefined }, // Debe coincidir con el @RequestParam de Java
    });
    return data;
  },

  async enable(usernameOrEmail) {
    await api.put("/user/enable", null, {
      params: { usernameOrEmail },
    });
  },

  async disable(usernameOrEmail) {
    await api.put("/user/disable", null, {
      params: { usernameOrEmail },
    });
  },

  async listRoles() {
    const { data } = await api.get("/role");
    return data;
  },

  async assignRole(usernameOrEmail, roleName) {
    await api.put("/user/assign-role", { usernameOrEmail, roleName });
  },

  async removeRole(usernameOrEmail, roleName) {
    await api.put("/user/remove-role", { usernameOrEmail, roleName });
  },

  async changePassword(usernameoremail, oldPassword, newPassword) {
    await api.post("/user/change-password", {
      usernameoremail,
      oldPassword,
      newPassword,
    });
  },
};
