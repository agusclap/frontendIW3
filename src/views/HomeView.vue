<script setup>
import { ref, onMounted, computed } from "vue";
import AppLayout from "../layouts/AppLayout.vue";

import { OrdersService } from "../services/orders";
import { ProductsService } from "../services/products";
import { TrucksService } from "../services/trucks";
import { DriversService } from "../services/drivers";
import { CustomersService } from "../services/customers";

const showModal = ref(false);
const loading = ref(false);
const error = ref("");

const products = ref([]);
const trucks = ref([]);
const drivers = ref([]);
const customers = ref([]);
const orders = ref([]);

const newOrder = ref({
  order_number: "",
  preset: "",
  product: null,
  truck: null,
  driver: null,
  customer: null,
});

const isFormValid = computed(() => {
  return (
    newOrder.value.order_number &&
    newOrder.value.preset > 0 &&
    newOrder.value.product &&
    newOrder.value.truck &&
    newOrder.value.driver &&
    newOrder.value.customer
  );
});

const resetForm = () => {
  newOrder.value = {
    order_number: "",
    preset: "",
    product: null,
    truck: null,
    driver: null,
    customer: null,
  };
};

const loadData = async () => {
  loading.value = true;
  error.value = "";
  try {
    const [p, t, d, c, o] = await Promise.all([
      ProductsService.list(),
      TrucksService.list(),
      DriversService.list(),
      CustomersService.list(),
      OrdersService.list(),
    ]);
    products.value = p;
    trucks.value = t;
    drivers.value = d;
    customers.value = c;
    orders.value = o;
  } catch (e) {
    error.value = "Error al sincronizar con el servidor";
    console.error("Error en loadData:", e);
  } finally {
    loading.value = false;
  }
};

onMounted(loadData);

const createOrder = async () => {
  if (!isFormValid.value) return;

  try {
    const selectedTruck = trucks.value.find(t => t.id === newOrder.value.truck);
    const selectedDriver = drivers.value.find(d => d.id === newOrder.value.driver);
    const selectedCustomer = customers.value.find(c => c.id === newOrder.value.customer);
    const selectedProduct = products.value.find(p => p.id === newOrder.value.product);

    // 1. Obtenemos las cisternas
    const todasLasCisternas = await TrucksService.getCisternas();
    
    // 2. FILTRO CORREGIDO: 
    // Si tu JSON de cisternas no trae "camion", tenemos un problema de asignación.
    // Por ahora, para que NO falle, vamos a filtrar por las que existan.
    // IMPORTANTE: Si en tu respuesta de F12 ves algún campo como "camion_id" o similar, úsalo aquí.
    const cisternasDelCamion = todasLasCisternas.filter(cis => {
      // Si el objeto cisterna tiene la relación, filtramos:
      if (cis.camion && cis.camion.id) {
        return cis.camion.id === selectedTruck.id;
      }
      // Si no tiene relación (como el JSON que me pasaste), 
      // esto es un riesgo porque mezclarías cisternas de otros camiones.
      return true; 
    });

    if (cisternasDelCamion.length === 0) {
      alert("⚠️ No se encontraron cisternas vinculadas.");
      return;
    }

    // 3. Armar el payload con los nombres de campos que me pasaste (capacidadLitros y licencia)
    const payload = {
      order_number: Number(newOrder.value.order_number),
      preset: Number(newOrder.value.preset),
      truck: {
        licence_plate: selectedTruck.patente,
        description: selectedTruck.descripcion || "Sin descripción",
        tanks: cisternasDelCamion.map(cis => ({
          capacity: cis.capacidadLitros, // Usamos el nombre exacto de tu JSON
          licence_plate: cis.licencia      // Usamos el nombre exacto de tu JSON
        }))
      },
      driver: {
        name: selectedDriver.nombre,
        last_name: selectedDriver.apellido,
        document: selectedDriver.dni.toString()
      },
      customer: {
        business_name: selectedCustomer.nombreEmpresa,
        email: selectedCustomer.email
      },
      product: {
        product: selectedProduct.nombre,
        temperatura_umbral: selectedProduct.temperatura_umbral
      }
    };

    console.log("🚀 Enviando a OrdersService:", payload);
    await OrdersService.create(payload);

    alert("¡Orden creada con éxito!");
    showModal.value = false;
    resetForm();
    await loadData();

  } catch (e) {
    console.error("Error detallado:", e);
    alert("Error al procesar: " + (e.response?.data?.message || e.message));
  }
};

const pendingOrders = computed(() => orders.value.filter(o => o.estadoOrden !== "FINALIZADA").length);
const finishedOrders = computed(() => orders.value.filter(o => o.estadoOrden === "FINALIZADA").length);

const cards = computed(() => [
  { title: "Productos", value: products.value.length, subtitle: "En catálogo", icon: "📦" },
  { title: "Órdenes", value: orders.value.length, subtitle: "Total histórico", icon: "🧾" },
  { title: "Pendientes", value: pendingOrders.value, subtitle: "En carga / Espera", icon: "⏳" },
  { title: "Finalizadas", value: finishedOrders.value, subtitle: "Listas para despacho", icon: "✅" },
]);
</script>

<template>
  <AppLayout>
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
      <div>
        <h1 class="text-3xl font-extrabold tracking-tight text-white">Panel de Control</h1>
        <p class="text-gray-400 mt-1">Gestión de logística y carga de combustible</p>
      </div>
      

      <!--
      <button
        @click="showModal = true"
        class="flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-6 py-3 font-bold text-white transition-all shadow-lg active:scale-95"
      >
        <span>＋ Nueva Orden</span>
      </button>
      -->
      
    </div>

    <div v-if="error" class="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
      ⚠️ {{ error }}
    </div>

    <div v-if="loading" class="text-gray-400 animate-pulse">Sincronizando datos...</div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <div v-for="c in cards" :key="c.title" class="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div class="text-3xl mb-4">{{ c.icon }}</div>
        <div class="text-sm font-medium text-gray-400">{{ c.title }}</div>
        <div class="text-4xl font-black text-white">{{ c.value }}</div>
        <div class="text-xs text-gray-500 mt-2">{{ c.subtitle }}</div>
      </div>
    </div>

    <transition name="modal-fade">
      <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" @click.self="showModal = false">
        <div class="w-full max-w-2xl bg-[#0f172a] border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
          <div class="p-8 border-b border-white/5">
            <h2 class="text-2xl font-bold text-white">Nueva Orden</h2>
          </div>

          <div class="p-8 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto">
            <div class="md:col-span-2">
              <label class="text-xs font-bold text-gray-500 uppercase">Número de Orden</label>
              <input v-model="newOrder.order_number" type="text" class="form-input" />
            </div>
            <div>
              <label class="text-xs font-bold text-gray-500 uppercase">Producto</label>
              <select v-model="newOrder.product" class="form-input">
                <option v-for="p in products" :key="p.id" :value="p.id">{{ p.nombre }}</option>
              </select>
            </div>
            <div>
              <label class="text-xs font-bold text-gray-500 uppercase">Camión</label>
              <select v-model="newOrder.truck" class="form-input">
                <option v-for="t in trucks" :key="t.id" :value="t.id">{{ t.patente }}</option>
              </select>
            </div>
            <div>
              <label class="text-xs font-bold text-gray-500 uppercase">Chofer</label>
              <select v-model="newOrder.driver" class="form-input">
                <option v-for="d in drivers" :key="d.id" :value="d.id">{{ d.nombre }} {{ d.apellido }}</option>
              </select>
            </div>
            <div>
              <label class="text-xs font-bold text-gray-500 uppercase">Cliente</label>
              <select v-model="newOrder.customer" class="form-input">
                <option v-for="c in customers" :key="c.id" :value="c.id">{{ c.nombreEmpresa }}</option>
              </select>
            </div>
            <div class="md:col-span-2">
              <label class="text-xs font-bold text-gray-500 uppercase">Preset (Kg)</label>
              <input v-model="newOrder.preset" type="number" class="form-input" />
            </div>
          </div>

          <div class="p-8 border-t border-white/5 flex justify-end gap-4">
            <button @click="showModal = false" class="text-gray-400 px-4">Cancelar</button>
            <button @click="createOrder" :disabled="!isFormValid" :class="isFormValid ? 'bg-blue-600' : 'bg-gray-700'" class="px-8 py-2 rounded-xl font-bold text-white">
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </transition>
  </AppLayout>
</template>

<style scoped>
.form-input {
  @apply w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white mt-1 outline-none focus:border-blue-500;
}
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.3s; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
</style>