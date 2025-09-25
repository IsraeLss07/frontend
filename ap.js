const productList = document.getElementById("product-list");
const productCount = document.getElementById("product-count");
const searchInput = document.getElementById("search");
const modal = document.getElementById('productModal');
const addProductBtn = document.getElementById('addProduct');
const closeBtn = document.querySelector('.close');
const cancelBtn = document.getElementById('cancelBtn');
const productForm = document.getElementById('productForm');

// Configuración de API - conecta directamente con Railway
const API_BASE_URL = 'https://backend-production-e530.up.railway.app/api';

let products = [];
let currentPage = 1;
let pageSize = 10;
let totalPages = 0;
let totalItems = 0;
let currentSearch = '';

function showLoadingState() {
  productList.innerHTML = `
    <tr>
      <td colspan="3" style="text-align: center; color: #3498db; padding: 40px;">
        <div style="display: inline-block; margin-right: 10px;">⏳</div>
        Cargando productos...
      </td>
    </tr>
  `;
  productCount.textContent = "Cargando...";
}

async function loadProducts(search = '', page = 1, size = 10) {
  try {
    showLoadingState();
    
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: size.toString()
    });
    
    if (search) {
      params.append('search', search);
    }
    
    const url = `${API_BASE_URL}/products?${params.toString()}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    
    const result = await response.json();
    
    products = result.data;
    currentPage = result.currentPage;
    pageSize = result.pageSize;
    totalPages = result.totalPages;
    totalItems = result.totalItems;
    currentSearch = search;
    
    renderProducts(products);
    updatePaginationInfo();
    updatePaginationControls();
    
  } catch (error) {
    console.error('Error al cargar productos:', error);
    productList.innerHTML = `
      <tr>
        <td colspan="3" style="text-align: center; color: #e74c3c; padding: 40px;">
          <div style="margin-bottom: 10px;">❌ Error al cargar los productos</div>
          <div style="font-size: 0.9em; color: #bbb;">
            Verifique que el servidor esté funcionando en ${API_BASE_URL}
          </div>
        </td>
      </tr>
    `;
    productCount.textContent = "Error al cargar productos";
    showNotification('Error al conectar con el servidor. Verifique que esté funcionando.', 'error');
  }
}

async function createProduct(productData) {
  try {
    const response = await fetch(`${API_BASE_URL}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(productData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Error HTTP: ${response.status}`);
    }

    const newProduct = await response.json();
    return newProduct;
  } catch (error) {
    console.error('Error al crear producto:', error);
    throw error;
  }
}

function renderProducts(items) {
  productList.innerHTML = "";
  items.forEach(p => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${p.name}</td>
      <td>$${p.price.toFixed(2)}</td>
      <td>${p.stock}</td>
    `;
    productList.appendChild(row);
  });
  productCount.textContent = `${items.length} productos encontrados`;
  
  adjustTableContainerHeight();
}

function adjustTableContainerHeight() {
  const tableContainer = document.getElementById('table-container');
  const currentPageSize = getCurrentPageSize();
  
  const headerHeight = 40;
  const rowHeight = 45;
  const minRows = Math.max(5, currentPageSize);
  const calculatedHeight = headerHeight + (minRows * rowHeight);
  
  tableContainer.style.minHeight = `${calculatedHeight}px`;
}

function getCurrentPageSize() {
  return pageSize || 10;
}

// Buscar productos con debounce para evitar muchas peticiones
let searchTimeout;
searchInput.addEventListener("input", e => {
  const term = e.target.value.trim();
  
  clearTimeout(searchTimeout);
  
  searchTimeout = setTimeout(() => {
    loadProducts(term, 1, pageSize);
  }, 300);
});

document.addEventListener('DOMContentLoaded', () => {
  loadProducts('', 1, 10);
  setupValidation();
  setupPaginationEvents();
  
  adjustTableContainerHeight();
});

function setupValidation() {
  const nameInput = document.getElementById('productName');
  const priceInput = document.getElementById('productPrice');
  const stockInput = document.getElementById('productStock');

  nameInput.addEventListener('blur', () => validateName(nameInput.value));
  nameInput.addEventListener('input', () => clearError('nameError', nameInput));
  
  priceInput.addEventListener('blur', () => validatePrice(priceInput.value));
  priceInput.addEventListener('input', () => clearError('priceError', priceInput));
  
  stockInput.addEventListener('blur', () => validateStock(stockInput.value));
  stockInput.addEventListener('input', () => clearError('stockError', stockInput));
}

// Modal functionality

// Abrir modal
addProductBtn.addEventListener('click', () => {
  modal.style.display = 'block';
  document.body.style.overflow = 'hidden'; // Prevenir scroll del body
});

function closeModal() {
  modal.style.display = 'none';
  document.body.style.overflow = 'auto';
  productForm.reset();
  clearAllErrors();
}

closeBtn.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);

window.addEventListener('click', (event) => {
  if (event.target === modal) {
    closeModal();
  }
});

productForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Validar formulario antes de enviar
  if (!validateForm()) {
    showNotification('Por favor corrige los errores en el formulario', 'error');
    return;
  }
  
  const submitButton = productForm.querySelector('button[type="submit"]');
  const originalText = submitButton.textContent;
  
  try {
    // Deshabilitar el botón y mostrar estado de carga
    submitButton.disabled = true;
    submitButton.textContent = 'Guardando...';
    
    const productName = document.getElementById('productName').value.trim();
    const productPrice = parseFloat(document.getElementById('productPrice').value);
    const productStock = parseInt(document.getElementById('productStock').value);
    
    // Validaciones adicionales del lado del cliente
    if (!productName) {
      throw new Error('El nombre del producto es requerido');
    }
    
    if (productPrice <= 0) {
      throw new Error('El precio debe ser mayor a 0');
    }
    
    if (productStock < 0) {
      throw new Error('El stock no puede ser negativo');
    }
    
    const productData = {
      name: productName,
      price: productPrice,
      stock: productStock
    };
    
    // Crear el producto en el backend
    const newProduct = await createProduct(productData);
    
    // Cerrar modal después de guardar exitosamente
    closeModal();
    
    // Recargar la lista de productos para mostrar el nuevo producto
    await loadProducts(currentSearch, currentPage, pageSize);
    
    // Mostrar mensaje de éxito
    showNotification('Producto agregado exitosamente', 'success');
    
  } catch (error) {
    console.error('Error al guardar producto:', error);
    showNotification(error.message || 'Error al guardar el producto', 'error');
  } finally {
    // Rehabilitar el botón
    submitButton.disabled = false;
    submitButton.textContent = originalText;
  }
});

// Función para mostrar notificaciones
function showNotification(message, type = 'info') {
  // Crear elemento de notificación
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  
  // Estilos inline para la notificación
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 4px;
    color: white;
    font-weight: 500;
    z-index: 1001;
    max-width: 300px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    animation: slideIn 0.3s ease-out;
  `;
  
  // Colores según el tipo
  switch (type) {
    case 'success':
      notification.style.backgroundColor = '#27ae60';
      break;
    case 'error':
      notification.style.backgroundColor = '#e74c3c';
      break;
    default:
      notification.style.backgroundColor = '#3498db';
  }
  
  // Agregar al DOM
  document.body.appendChild(notification);
  
  // Remover después de 4 segundos
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-in';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 4000);
}

// Cerrar modal con tecla Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal.style.display === 'block') {
    closeModal();
  }
});

// Funciones de validación
function validateName(name) {
  const nameError = document.getElementById('nameError');
  const nameInput = document.getElementById('productName');
  
  if (!name || name.trim().length === 0) {
    showError('nameError', 'El nombre es obligatorio', nameInput);
    return false;
  }
  
  if (name.trim().length < 2) {
    showError('nameError', 'El nombre debe tener al menos 2 caracteres', nameInput);
    return false;
  }
  
  if (name.trim().length > 100) {
    showError('nameError', 'El nombre no puede exceder 100 caracteres', nameInput);
    return false;
  }

  // Verificar si ya existe un producto con ese nombre
  const existingProduct = products.find(p => 
    p.name.toLowerCase() === name.trim().toLowerCase()
  );
  
  if (existingProduct) {
    showError('nameError', 'Ya existe un producto con ese nombre', nameInput);
    return false;
  }
  
  clearError('nameError', nameInput);
  nameInput.classList.add('valid');
  return true;
}

function validatePrice(price) {
  const priceError = document.getElementById('priceError');
  const priceInput = document.getElementById('productPrice');
  
  if (!price || price === '') {
    showError('priceError', 'El precio es obligatorio', priceInput);
    return false;
  }
  
  const numPrice = parseFloat(price);
  
  if (isNaN(numPrice)) {
    showError('priceError', 'El precio debe ser un número válido', priceInput);
    return false;
  }
  
  if (numPrice <= 0) {
    showError('priceError', 'El precio debe ser mayor a 0', priceInput);
    return false;
  }
  
  if (numPrice > 999999.99) {
    showError('priceError', 'El precio no puede exceder $999,999.99', priceInput);
    return false;
  }
  
  clearError('priceError', priceInput);
  priceInput.classList.add('valid');
  return true;
}

function validateStock(stock) {
  const stockError = document.getElementById('stockError');
  const stockInput = document.getElementById('productStock');
  
  if (stock === '' || stock === null || stock === undefined) {
    showError('stockError', 'El stock es obligatorio', stockInput);
    return false;
  }
  
  const numStock = parseInt(stock);
  
  if (isNaN(numStock)) {
    showError('stockError', 'El stock debe ser un número entero', stockInput);
    return false;
  }
  
  if (numStock < 0) {
    showError('stockError', 'El stock no puede ser negativo', stockInput);
    return false;
  }
  
  if (numStock > 999999) {
    showError('stockError', 'El stock no puede exceder 999,999 unidades', stockInput);
    return false;
  }
  
  clearError('stockError', stockInput);
  stockInput.classList.add('valid');
  return true;
}

function showError(errorId, message, inputElement) {
  const errorElement = document.getElementById(errorId);
  errorElement.textContent = message;
  errorElement.classList.add('show');
  inputElement.classList.add('error');
  inputElement.classList.remove('valid');
}

function clearError(errorId, inputElement) {
  const errorElement = document.getElementById(errorId);
  errorElement.classList.remove('show');
  inputElement.classList.remove('error');
}

function clearAllErrors() {
  const errorElements = document.querySelectorAll('.error-message');
  const inputElements = document.querySelectorAll('.form-group input');
  
  errorElements.forEach(error => error.classList.remove('show'));
  inputElements.forEach(input => {
    input.classList.remove('error', 'valid');
  });
}

function validateForm() {
  const name = document.getElementById('productName').value;
  const price = document.getElementById('productPrice').value;
  const stock = document.getElementById('productStock').value;
  
  const nameValid = validateName(name);
  const priceValid = validatePrice(price);
  const stockValid = validateStock(stock);
  
  return nameValid && priceValid && stockValid;
}

// Funciones de paginación
function updatePaginationInfo() {
  const paginationInfo = document.getElementById('pagination-info');
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);
  
  paginationInfo.textContent = `Mostrando ${start}-${end} de ${totalItems} productos`;
  productCount.textContent = `${totalItems} productos encontrados`;
}

function updatePaginationControls() {
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');
  const pageNumbers = document.getElementById('pageNumbers');
  
  // Actualizar botones anterior/siguiente
  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = currentPage >= totalPages;
  
  // Generar números de página
  pageNumbers.innerHTML = generatePageNumbers();
  
  // Actualizar selector de tamaño de página
  const pageSizeSelect = document.getElementById('pageSize');
  pageSizeSelect.value = pageSize;
}

function generatePageNumbers() {
  let html = '';
  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
  
  // Ajustar si estamos cerca del final
  if (endPage - startPage < maxVisiblePages - 1) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }
  
  // Botón primera página
  if (startPage > 1) {
    html += `<button class="page-number" onclick="goToPage(1)">1</button>`;
    if (startPage > 2) {
      html += `<span class="page-number ellipsis">...</span>`;
    }
  }
  
  // Páginas centrales
  for (let i = startPage; i <= endPage; i++) {
    const activeClass = i === currentPage ? 'active' : '';
    html += `<button class="page-number ${activeClass}" onclick="goToPage(${i})">${i}</button>`;
  }
  
  // Botón última página
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      html += `<span class="page-number ellipsis">...</span>`;
    }
    html += `<button class="page-number" onclick="goToPage(${totalPages})">${totalPages}</button>`;
  }
  
  return html;
}

function goToPage(page) {
  if (page !== currentPage && page >= 1 && page <= totalPages) {
    loadProducts(currentSearch, page, pageSize);
  }
}

function goToPrevPage() {
  if (currentPage > 1) {
    goToPage(currentPage - 1);
  }
}

function goToNextPage() {
  if (currentPage < totalPages) {
    goToPage(currentPage + 1);
  }
}

function changePageSize() {
  const pageSizeSelect = document.getElementById('pageSize');
  const newPageSize = parseInt(pageSizeSelect.value);
  
  if (newPageSize !== pageSize) {
    // Ajustar altura del contenedor inmediatamente para evitar salto visual
    adjustTableContainerHeight();
    
    // Calcular nueva página para mantener los elementos visibles
    const firstItem = (currentPage - 1) * pageSize + 1;
    const newPage = Math.ceil(firstItem / newPageSize);
    
    loadProducts(currentSearch, newPage, newPageSize);
  }
}

// Configurar eventos de paginación
function setupPaginationEvents() {
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');
  const pageSizeSelect = document.getElementById('pageSize');
  
  prevBtn.addEventListener('click', goToPrevPage);
  nextBtn.addEventListener('click', goToNextPage);
  pageSizeSelect.addEventListener('change', changePageSize);
}