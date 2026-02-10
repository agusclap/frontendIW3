import { api } from "./api";

export const TrucksService = {
  // Lista todos los camiones
  async list() {
    const { data } = await api.get("/camiones");
    return data;
  },

  // Lista todas las cisternas para luego filtrarlas en el front
  // Asegúrate de que la ruta "/cisternas" coincida con tu RequestMapping en Java
  async getCisternas() {
    try {
      const { data } = await api.get("/cisternas");
      return data;
    } catch (error) {
      console.error("Error al obtener cisternas:", error);
      throw error;
    }
  }
};