import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { can } from './directives/can'
import { installErrorHandling } from './api/interceptors'
import { registerServiceWorker } from './pwa'
import './styles/main.css'

installErrorHandling(router)
createApp(App).use(createPinia()).use(router).directive('can', can).mount('#app')
registerServiceWorker()
