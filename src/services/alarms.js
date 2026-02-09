import { api } from "./api";

export const AlarmsService = {
  async list() {
    const { data } = await api.get("/alarms");
    return data;
  },

  async accept(id) {
    await api.post(`/orden/accept-alarm?idAlarm=${id}`);
  },
};
