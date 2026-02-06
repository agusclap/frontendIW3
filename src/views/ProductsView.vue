<script setup>
import { ref, computed, onMounted } from "vue";
import AppLayout from "../layouts/AppLayout.vue";
import { ProductsService } from "../services/products";

const q = ref("");
const products = ref([]);
const loading = ref(false);
const error = ref("");

const load = async () => {
  loading.value = true;
  error.value = "";

  try {
    products.value = await ProductsService.list();
  } catch (e) {
    error.value = e?.response?.data?.message || "Error cargando productos";
  } finally {
    loading.value = false;
  }
};

onMounted(load);

const filtered = computed(() =>
  products.value.filter((p) =>
    p.nombre?.toLowerCase().includes(q.value.toLowerCase())
  )
);

const removeProduct = async (id) => {
  if (!confirm("¿Eliminar producto?")) return;

  try {
    await ProductsService.remove(id);
    await load();
  } catch (e) {
    alert("Error eliminando producto");
  }
};
</script>

<template>
  <AppLayout>
    <!-- HEADER -->
    <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold">Productos</h1>
        <p class="text-gray-400 mt-1">Gestioná tu catálogo</p>
      </div>

      <div class="flex gap-3">
        <input
          v-model="q"
          placeholder="Buscar..."
          class="w-full md:w-72 rounded-xl bg-black/30 border border-white/10 px-4 py-2 text-white
                 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
        />

        <button
          @click="load"
          class="rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 font-semibold transition"
        >
          🔄 Recargar
        </button>
      </div>
    </div>

    <!-- ERROR -->
    <div
      v-if="error"
      class="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200"
    >
      {{ error }}
    </div>

    <!-- TABLA -->
    <div class="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
      <div v-if="loading" class="p-6 text-gray-300">
        Cargando productos...
      </div>

      <table v-else class="w-full text-sm">
        <thead class="bg-black/30 text-gray-300">
          <tr>
            <th class="text-left px-5 py-4">Nombre</th>
            <th class="text-left px-5 py-4">Descripción</th>
            <th class="text-left px-5 py-4">Temp. Umbral</th>
            <th class="text-right px-5 py-4">Acciones</th>
          </tr>
        </thead>

        <tbody>
          <tr
            v-for="p in filtered"
            :key="p.id"
            class="border-t border-white/10 hover:bg-white/5 transition"
          >
            <td class="px-5 py-4 font-medium">
              {{ p.nombre }}
            </td>

            <td class="px-5 py-4 text-gray-300">
              {{ p.descripcion || "—" }}
            </td>

            <td class="px-5 py-4 text-gray-300">
              {{ p.temperatura_umbral }}
            </td>

            <td class="px-5 py-4 text-right">
              <button class="text-blue-300 hover:text-blue-200 mr-4">
                Editar
              </button>

              <button
                @click="removeProduct(p.id)"
                class="text-red-300 hover:text-red-200"
              >
                Eliminar
              </button>
            </td>
          </tr>

          <tr v-if="filtered.length === 0">
            <td colspan="4" class="px-5 py-10 text-center text-gray-400">
              No hay productos.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </AppLayout>
</template>
