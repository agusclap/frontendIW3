<script setup>
import { ref, computed, onMounted } from "vue";
import AppLayout from "../layouts/AppLayout.vue";
import { ProductsService } from "../services/products";

const q = ref("");
const products = ref([]);
const loading = ref(false);
const error = ref("");
const editingProduct = ref(null);
const form = ref({ productId: null, nombre: "", descripcion: "", temperatura_umbral: null });
const saving = ref(false);
const formError = ref("");
const deleteError = ref("");

const load = async (bustCache = false) => {
  loading.value = true;
  error.value = "";
  deleteError.value = "";
  try {
    products.value = await ProductsService.list(bustCache);
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

function openEdit(p) {
  editingProduct.value = p;
  const numId = p.id != null && p.id !== "" ? Number(p.id) : p.id;
  form.value = {
    id: numId, // CAMBIAR 'productId' por 'id' para que Java lo reconozca
    nombre: p.nombre ?? "",
    descripcion: p.descripcion ?? "",
    temperatura_umbral: p.temperatura_umbral != null ? Number(p.temperatura_umbral) : null,
  };
  formError.value = "";
}

function closeEdit() {
  editingProduct.value = null;
  formError.value = "";
}

const saveProduct = async () => {
  if (!editingProduct.value) return;
  const id = form.value.productId != null && form.value.productId !== "" ? Number(form.value.productId) : editingProduct.value.id;
  const payload = {
    id,
    nombre: form.value.nombre.trim() || editingProduct.value.nombre,
    descripcion: form.value.descripcion?.trim() ?? "",
    temperatura_umbral: form.value.temperatura_umbral != null && form.value.temperatura_umbral !== "" ? Number(form.value.temperatura_umbral) : null,
  };
  // #region agent log
  fetch('http://127.0.0.1:7246/ingest/e8eacad5-e1b3-4f2d-a3a7-5d2583984d88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ProductsView.vue:saveProduct',message:'payload before update',data:{id,idType:typeof id,payload,formProductId:form.value.productId,editingProductId:editingProduct.value?.id},timestamp:Date.now(),hypothesisId:'H1-H2'})}).catch(()=>{});
  // #endregion
  if (id == null || id === undefined) {
    formError.value = "ID de producto no válido";
    return;
  }
  saving.value = true;
  formError.value = "";
  try {
    await ProductsService.update(payload);
    await load(true);
    closeEdit();
  } catch (e) {
    const d = e?.response?.data;
    formError.value = (typeof d === "string" ? d : d?.message ?? d?.error) || e?.message || "Error al actualizar";
  } finally {
    saving.value = false;
  }
};

const removeProduct = async (id) => {
  // #region agent log
  fetch('http://127.0.0.1:7246/ingest/e8eacad5-e1b3-4f2d-a3a7-5d2583984d88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ProductsView.vue:removeProduct',message:'removeProduct called',data:{id,idType:typeof id},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
  // #endregion
  if (id == null || id === undefined) {
    alert("ID de producto no válido");
    return;
  }
  if (!confirm("¿Eliminar este producto?")) return;
  deleteError.value = "";
  try {
    await ProductsService.remove(Number(id) || id);
    await load(true);
    if (editingProduct.value?.id === id || form.value.productId === id) closeEdit();
  } catch (e) {
    const d = e?.response?.data;
    deleteError.value = (typeof d === "string" ? d : d?.message ?? d?.error) || e?.message || "Error al eliminar";
  }
};
</script>

<template>
  <AppLayout>
    <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-white">Productos</h1>
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
          class="rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 font-semibold transition text-white"
        >
          🔄 Recargar
        </button>
      </div>
    </div>

    <div
      v-if="error"
      class="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200"
    >
      {{ error }}
    </div>
    <div
      v-if="deleteError"
      class="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200"
    >
      {{ deleteError }}
    </div>

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
            <!--
            <th class="text-right px-5 py-4">Acciones</th>
            -->
            
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="p in filtered"
            :key="p.id"
            class="border-t border-white/10 hover:bg-white/5 transition text-gray-200"
          >
            <td class="px-5 py-4 font-medium">{{ p.nombre }}</td>
            <td class="px-5 py-4 text-gray-300">{{ p.descripcion || "—" }}</td>
            <td class="px-5 py-4 text-gray-300 font-mono">{{ p.temperatura_umbral ?? "—" }}</td>
            <td class="px-5 py-4 text-right">
             
             <!--
              <button
                type="button"
                @click="openEdit(p)"
                class="text-blue-300 hover:text-blue-200 mr-4"
              >
                Editar
              </button>
              <button
                type="button"
                @click="removeProduct(p.id)"
                class="text-red-300 hover:text-red-200"
              >
                Eliminar
              </button>
             
             
             -->
              
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

    <!-- Modal Editar -->
    <Teleport to="body">
      <div
        v-if="editingProduct"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        @click.self="closeEdit"
      >
        <div
          class="w-full max-w-md rounded-2xl border border-white/10 bg-gray-900 shadow-xl"
          @click.stop
        >
          <div class="border-b border-white/10 px-5 py-4">
            <h2 class="text-lg font-semibold text-white">Editar producto</h2>
            <p class="text-xs text-gray-400 mt-0.5">ID: {{ form.productId ?? editingProduct.id }}</p>
          </div>
          <form class="p-5 space-y-4" @submit.prevent="saveProduct">
            <div>
              <label class="block text-xs font-medium text-gray-400 mb-1">Nombre</label>
              <input
                v-model="form.nombre"
                type="text"
                class="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                required
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-400 mb-1">Descripción</label>
              <input
                v-model="form.descripcion"
                type="text"
                class="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/60"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-400 mb-1">Temperatura umbral</label>
              <input
                v-model.number="form.temperatura_umbral"
                type="number"
                step="any"
                class="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-2.5 text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                placeholder="Ej. 100"
              />
            </div>
            <p v-if="formError" class="text-sm text-red-300">{{ formError }}</p>
            <div class="flex gap-3 pt-2">
              <button
                type="button"
                @click="closeEdit"
                class="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-gray-200 hover:bg-white/10 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                :disabled="saving"
                class="flex-1 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2.5 font-semibold text-white transition disabled:opacity-50"
              >
                {{ saving ? "Guardando…" : "Guardar" }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </AppLayout>
</template>
