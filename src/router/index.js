import { createRouter, createWebHistory } from "vue-router";
import LoginView from "../views/LoginView.vue";
import HomeView from "../views/HomeView.vue";
import OrdersView from "../views/OrdersView.vue";
import OrderDetailView from "../views/OrderDetailView.vue";
import ProductsView from "../views/ProductsView.vue";
import UsersView from "../views/UsersView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", component: LoginView, meta: { title: "Login", public: true } },
    { path: "/", component: HomeView, meta: { title: "Dashboard", requiresAuth: true } },
    { path: "/orders", component: OrdersView, meta: { title: "Órdenes", requiresAuth: true } },
    { path: "/orders/:id", component: OrderDetailView, meta: { title: "Detalle orden", requiresAuth: true } },
    { path: "/products", component: ProductsView, meta: { title: "Productos", requiresAuth: true } },
    { path: "/users", component: UsersView, meta: { title: "Usuarios", requiresAuth: true } }
  ],
});

// src/router/index.js
import { api } from "../services/api";

router.beforeEach(async (to) => {
  const token = localStorage.getItem("token");

  if (to.meta.requiresAuth && !token) {
    return { path: "/login", query: { redirect: to.fullPath } };
  }

  if (to.meta.requiresAuth && token) {
    try {
      await api.get("/auth/me");
    } catch {
      localStorage.removeItem("token");
      return { path: "/login", query: { redirect: to.fullPath } };
    }
  }
});


export default router;
