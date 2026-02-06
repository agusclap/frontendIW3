<script setup>
import { ref, onMounted, computed } from "vue";
import AppLayout from "../layouts/AppLayout.vue";
import { ProductsService } from "../services/products";
import { OrdersService } from "../services/orders";

const loading = ref(true);
const error = ref("");

const products = ref([]);
const orders = ref([]);

const load = async () => {
  loading.value = true;
  error.value = "";

  try {
    products.value = await ProductsService.list();
    orders.value = await OrdersService.list();
  } catch (e) {
    error.value = "Error cargando dashboard";
  } finally {
    loading.value = false;
  }
};

onMounted(load);

const totalProducts = computed(() => products.value.length);

const totalOrders = computed(() => orders.value.length);

const pendingOrders = computed(() =>
  orders.value.filter(
    (o) =>
      o.estado_orden !== "FINALIZADA"
  ).length
);

const finishedOrders = computed(() =>
  orders.value.filter(
    (o) =>
      o.estado_orden === "FINALIZADA"
  ).length
);

const cards = computed(() => [
  {
    title: "Productos",
    value: totalProducts.value,
    subtitle: "Total cargados",
    icon: "📦",
  },
  {
    title: "Órdenes",
    value: totalOrders.value,
    subtitle: "Registradas",
    icon: "🧾",
  },
  {
    title: "Pendientes",
    value: pendingOrders.value,
    subtitle: "En proceso",
    icon: "⏳",
  },
  {
    title: "Finalizadas",
    value: finishedOrders.value,
    subtitle: "Completadas",
    icon: "✅",
  },
]);
</script>


<template>
  <AppLayout>
    <div class="flex items-end justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold">Dashboard</h1>
        <p class="text-gray-400 mt-1">Resumen general del sistema</p>
      </div>

      <button
        class="hidden md:inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 font-semibold transition"
      >
        ➕ Nuevo
      </button>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      <div
        v-for="c in cards"
        :key="c.title"
        class="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg"
      >
        <div class="flex items-center justify-between">
          <div class="text-2xl">{{ c.icon }}</div>
          <div class="text-xs text-gray-400">Últimas 24h</div>
        </div>

        <div class="mt-4">
          <div class="text-sm text-gray-300">{{ c.title }}</div>
          <div class="text-3xl font-bold mt-1">{{ c.value }}</div>
          <div class="text-xs text-gray-400 mt-1">{{ c.subtitle }}</div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-6">
      <div class="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 class="font-semibold">Actividad</h2>
        <p class="text-gray-400 text-sm mt-1">Últimos movimientos (mock)</p>

        <div class="mt-4 space-y-3">
          <div class="flex items-center justify-between rounded-xl bg-black/30 border border-white/10 p-4">
            <div>
              <div class="font-medium">Producto actualizado</div>
              <div class="text-xs text-gray-400">Se actualizó stock de “Camión 12T”.</div>
            </div>
            <div class="text-xs text-gray-400">hace 10m</div>
          </div>

          <div class="flex items-center justify-between rounded-xl bg-black/30 border border-white/10 p-4">
            <div>
              <div class="font-medium">Orden creada</div>
              <div class="text-xs text-gray-400">Nueva orden #1048 (cliente: ACME).</div>
            </div>
            <div class="text-xs text-gray-400">hace 1h</div>
          </div>

          <div class="flex items-center justify-between rounded-xl bg-black/30 border border-white/10 p-4">
            <div>
              <div class="font-medium">Usuario registrado</div>
              <div class="text-xs text-gray-400">Se creó el usuario “operador1”.</div>
            </div>
            <div class="text-xs text-gray-400">ayer</div>
          </div>
        </div>
      </div>

      <div class="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 class="font-semibold">Acciones rápidas</h2>
        <p class="text-gray-400 text-sm mt-1">Atajos para operar</p>

        <div class="mt-4 space-y-3">
          <router-link
            to="/products"
            class="block rounded-xl bg-black/30 border border-white/10 p-4 hover:bg-white/5 transition"
          >
            <div class="font-medium">Ir a Productos</div>
            <div class="text-xs text-gray-400">Gestionar catálogo y stock</div>
          </router-link>

          <router-link
            to="/orders"
            class="block rounded-xl bg-black/30 border border-white/10 p-4 hover:bg-white/5 transition"
          >
            <div class="font-medium">Ver Órdenes</div>
            <div class="text-xs text-gray-400">Pendientes y completadas</div>
          </router-link>

          <router-link
            to="/users"
            class="block rounded-xl bg-black/30 border border-white/10 p-4 hover:bg-white/5 transition"
          >
            <div class="font-medium">Usuarios</div>
            <div class="text-xs text-gray-400">Roles y permisos</div>
          </router-link>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
