<!-- src/views/Portfolio.vue -->
<template>
  <v-container>
    <v-card color="surface">
      <v-card-title>
        <span class="text-h5">My Portfolio</span>
        <v-spacer></v-spacer>
        <v-btn color="primary" @click="openAddDialog">Add Stock</v-btn>
      </v-card-title>

      <v-data-table
        :headers="headers"
        :items="stocks"
        class="elevation-1"
      >
        <!-- Header with Tooltips -->
        <template #header="{ props }">
          <tr>
            <th
              v-for="(header, index) in props.headers"
              :key="index"
              :class="['text-start', header.cellClass]"
              @click="props.sort(header.value)"
            >
              <v-tooltip bottom>
                <template #activator="{ on, attrs }">
                  <span v-bind="attrs" v-on="on" class="header-title">
                    {{ header.text }}
                    <v-icon small>mdi-information-outline</v-icon>
                  </span>
                </template>
                <span>{{ header.definition }}</span>
              </v-tooltip>
            </th>
          </tr>
        </template>

        <!-- Data Cells -->
        <template #item.price="{ item }">
          ${{ item.price.toFixed(2) }}
        </template>
        <template #item.totalValue="{ item }">
          ${{ (item.price * item.quantity).toFixed(2) }}
        </template>
        <!-- Actions Column -->
        <template #item.actions="{ item }">
          <v-icon small @click="deleteStock(item.symbol)" color="red">
            mdi-delete
          </v-icon>
        </template>
      </v-data-table>
    </v-card>

    <!-- Stock Selection for Chart -->
    <v-select
      :items="stockSymbols"
      v-model="selectedStock"
      label="Select Stock"
      class="mt-5"
      color="primary"
    ></v-select>

    <!-- Stock History Chart -->
    <div v-if="chartSeries.length">
      <apexchart
        type="line"
        height="350"
        :options="chartOptions"
        :series="chartSeries"
        class="mt-3"
      ></apexchart>
    </div>
    <div v-else>
      <p>No historical data available for the selected stock.</p>
    </div>

    <!-- Add Stock Dialog -->
    <v-dialog v-model="addDialog" max-width="500px">
      <v-card color="surface">
        <v-card-title>Add a New Stock</v-card-title>
        <v-card-text>
          <!-- Updated v-autocomplete -->
          <v-autocomplete
            v-model="newStock.symbol"
            :items="searchResults"
            label="Symbol"
            color="primary"
            :loading="isLoading"
            @update:search="onSearchInput"
            item-title="display"
            item-value="symbol"
            return-object
            clearable
            no-data-text="No matching stocks found."
          ></v-autocomplete>
          <v-text-field
            v-model="newStock.quantity"
            label="Quantity"
            type="number"
            color="primary"
          ></v-text-field>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn text color="secondary" @click="addDialog = false">Cancel</v-btn>
          <v-btn
            color="primary"
            @click="addStock"
            :disabled="!newStock.symbol || newStock.quantity <= 0"
          >
            Add
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { reactive, ref, onMounted, watch, onUnmounted } from 'vue';
import axios from 'axios';
import { w3cwebsocket as W3CWebSocket } from 'websocket';

const apiKey = 'cri724pr01qqt33r8nvgcri724pr01qqt33r8o00'; // Replace with your actual API key

// Data references
const headers = [
  {
    text: 'Symbol',
    value: 'symbol',
    definition: 'The stock ticker symbol (e.g., AAPL for Apple Inc.)',
  },
  {
    text: 'Company',
    value: 'company',
    definition: 'The full name of the company',
  },
  {
    text: 'Quantity',
    value: 'quantity',
    definition: 'The number of shares you own',
  },
  {
    text: 'Price',
    value: 'price',
    definition: 'The current price per share',
  },
  {
    text: 'Total Value',
    value: 'totalValue',
    definition: 'Total value of your holdings (Price x Quantity)',
  },
  {
    text: 'Actions',
    value: 'actions',
    sortable: false,
    definition: 'Actions you can perform on the stock (e.g., delete)',
  },
];

const stocks = reactive([]); // Use reactive array for stocks
const stockSymbols = ref([]);
const selectedStock = ref('');
const addDialog = ref(false);
const newStock = reactive({ symbol: null, quantity: 0 });

// Autocomplete data
const searchResults = ref([]);
const isLoading = ref(false);

// Chart data
const chartOptions = ref({});
const chartSeries = ref([]);

// WebSocket client
let client = null;

// Functions
const openAddDialog = () => {
  newStock.symbol = null;
  newStock.quantity = 0;
  searchResults.value = [];
  addDialog.value = true;
};

// Function to handle search input changes
const onSearchInput = async (searchText) => {
  if (searchText && searchText.length >= 2) {
    isLoading.value = true;
    try {
      const res = await axios.get(
        `https://finnhub.io/api/v1/search?q=${encodeURIComponent(
          searchText
        )}&token=${apiKey}`
      );
      if (res.data && res.data.count > 0) {
        searchResults.value = res.data.result.map((item) => ({
          symbol: item.symbol,
          description: item.description,
          display: `${item.symbol} - ${item.description}`,
        }));
      } else {
        searchResults.value = [];
      }
    } catch (error) {
      console.error('Error fetching symbol search results:', error);
      searchResults.value = [];
    } finally {
      isLoading.value = false;
    }
  } else {
    searchResults.value = [];
  }
};

const addStock = () => {
  if (newStock.symbol && newStock.quantity > 0) {
    const symbol = newStock.symbol.symbol.toUpperCase();
    // Check if stock already exists
    if (!stocks.some((stock) => stock.symbol === symbol)) {
      const newStockEntry = {
        symbol: symbol,
        company: newStock.symbol.description || '',
        quantity: newStock.quantity,
        price: 0,
      };
      stocks.push(newStockEntry);
      fetchStockData(symbol);
      subscribeToStock(symbol); // Subscribe to real-time updates for the new stock
      addDialog.value = false;
    } else {
      alert('Stock already exists in your portfolio.');
    }
  }
};

const deleteStock = (symbol) => {
  const index = stocks.findIndex((stock) => stock.symbol === symbol);
  if (index !== -1) {
    unsubscribeFromStock(symbol);
    stocks.splice(index, 1);
    // Update stock symbols list
    stockSymbols.value = stocks.map((s) => s.symbol);
    // Update local storage
    localStorage.setItem('stocks', JSON.stringify(stocks));
    // Update selected stock if necessary
    if (selectedStock.value === symbol) {
      selectedStock.value = stocks[0]?.symbol || '';
    }
  }
};

const fetchStockData = async (symbol) => {
  try {
    const [quoteRes, profileRes] = await Promise.all([
      axios.get(
        `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`
      ),
      axios.get(
        `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${apiKey}`
      ),
    ]);

    const stock = stocks.find((s) => s.symbol === symbol);
    if (stock) {
      // Ensure price is properly updated
      if (quoteRes.data.c) {
        stock.price = quoteRes.data.c;
      } else if (quoteRes.data.pc) {
        stock.price = quoteRes.data.pc;
      } else {
        stock.price = 0;
      }
      // Update company name if available
      if (!stock.company || stock.company === '') {
        stock.company = profileRes.data.name || 'N/A';
      }
    }

    // Update stock symbols list
    stockSymbols.value = stocks.map((s) => s.symbol);

    // Fetch historical data if this stock is selected
    if (selectedStock.value === symbol) {
      await fetchHistoricalData(symbol);
    }
  } catch (error) {
    console.error(`Error fetching data for ${symbol}:`, error);
  }
};

const fetchAllStockData = () => {
  stocks.forEach((stock) => {
    fetchStockData(stock.symbol);
  });
};

const fetchHistoricalData = async (symbol) => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const oneMonthAgo = now - 30 * 24 * 60 * 60; // 30 days ago

    const res = await axios.get(
      `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=D&from=${oneMonthAgo}&to=${now}&token=${apiKey}`
    );

    if (res.data.s === 'ok') {
      const prices = res.data.c;
      const timestamps = res.data.t;

      const seriesData = timestamps.map((timestamp, index) => ({
        x: new Date(timestamp * 1000),
        y: prices[index],
      }));

      chartSeries.value = [
        {
          name: symbol,
          data: seriesData,
        },
      ];

      chartOptions.value = {
        chart: {
          type: 'line',
          zoom: { enabled: false },
          background: '#1E1E1E', // Match the surface color
          foreColor: '#FFFFFF', // Text color
          toolbar: {
            show: false,
          },
        },
        xaxis: {
          type: 'datetime',
          labels: {
            style: {
              colors: '#FFFFFF',
            },
          },
        },
        yaxis: {
          labels: {
            formatter: (value) => `$${value.toFixed(2)}`,
            style: {
              colors: '#FFFFFF',
            },
          },
        },
        grid: {
          borderColor: '#444',
        },
        stroke: {
          curve: 'smooth',
          width: 2,
        },
        dataLabels: {
          enabled: false,
        },
        tooltip: {
          theme: 'dark',
          x: {
            format: 'dd MMM yyyy',
          },
        },
        colors: ['#546E7A'], // Line color matches the primary theme color
      };
    } else {
      console.error(`Error fetching historical data for ${symbol}:`, res.data);
      chartSeries.value = [];
    }
  } catch (error) {
    console.error(`Error fetching historical data for ${symbol}:`, error);
    chartSeries.value = [];
  }
};

watch(selectedStock, (newSymbol) => {
  if (newSymbol) {
    fetchHistoricalData(newSymbol);
  } else {
    chartSeries.value = [];
  }
});

const startWebSocket = () => {
  client = new W3CWebSocket(`wss://ws.finnhub.io?token=${apiKey}`);

  client.onopen = () => {
    console.log('WebSocket Client Connected');
    // Subscribe to stock symbols
    stocks.forEach((stock) => {
      subscribeToStock(stock.symbol);
    });
  };

  client.onmessage = (message) => {
    const data = JSON.parse(message.data);
    if (data.type === 'trade') {
      data.data.forEach((trade) => {
        const stock = stocks.find((s) => s.symbol === trade.s);
        if (stock) {
          stock.price = trade.p;
        }
      });
    }
  };

  client.onclose = () => {
    console.log('WebSocket Client Disconnected');
  };
};

const subscribeToStock = (symbol) => {
  if (client && client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify({ type: 'subscribe', symbol }));
  }
};

const unsubscribeFromStock = (symbol) => {
  if (client && client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify({ type: 'unsubscribe', symbol }));
  }
};

// Local storage handling
watch(
  stocks,
  (newStocks) => {
    localStorage.setItem('stocks', JSON.stringify(newStocks));
  },
  { deep: true }
);

onMounted(() => {
  // Load stocks from local storage
  const savedStocks = localStorage.getItem('stocks');
  if (savedStocks) {
    const parsedStocks = JSON.parse(savedStocks);
    parsedStocks.forEach((stock) => stocks.push(stock));
  }

  // Initialize stock symbols list
  stockSymbols.value = stocks.map((s) => s.symbol);

  // Set default selected stock
  selectedStock.value = stocks[0]?.symbol || '';

  fetchAllStockData();

  if (selectedStock.value) {
    fetchHistoricalData(selectedStock.value);
  }

  startWebSocket();
});

onUnmounted(() => {
  if (client) {
    stocks.forEach((stock) => {
      unsubscribeFromStock(stock.symbol);
    });
    client.close();
  }
});
</script>

<style scoped>
.mt-5 {
  margin-top: 20px;
}
.mt-3 {
  margin-top: 12px;
}

/* Ensure the application background matches the theme */
.v-application {
  background-color: #121212 !important;
}

/* Additional styles for header titles */
.header-title {
  display: flex;
  align-items: center;
}

.header-title v-icon {
  margin-left: 4px;
}
</style>
