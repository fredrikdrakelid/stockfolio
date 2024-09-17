// src/main.js
import { createApp } from 'vue';
import App from './App.vue';

// Vuetify and other imports
import 'vuetify/styles';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import '@mdi/font/css/materialdesignicons.css';

// Router import
import router from './router';

// ApexCharts import
import VueApexCharts from 'vue3-apexcharts';

// Vuetify theme configuration with more subtle colors
const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'myCustomDarkTheme',
    themes: {
      myCustomDarkTheme: {
        dark: true,
        colors: {
          primary: '#546E7A',    // Subtle Blue Grey
          secondary: '#455A64',  // Darker Blue Grey
          background: '#121212', // Dark background
          surface: '#1E1E1E',    // Slightly lighter than background
          error: '#CF6679',
          info: '#0288D1',       // Subtle info color
          success: '#388E3C',    // Subtle success color
          warning: '#FBC02D',    // Subtle warning color
        },
      },
    },
  },
});

const app = createApp(App);
app.use(vuetify);
app.use(router);
app.use(VueApexCharts); // Register globally
app.mount('#app');
