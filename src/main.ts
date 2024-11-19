import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

const app = createApp(App)
  if (window.Worker) {
    const myWorker = new Worker("worker.ts")
    //给worker发送消息
    myWorker.postMessage("xxxx")
  }
app.use(createPinia())
app.use(router)

app.mount('#app')
