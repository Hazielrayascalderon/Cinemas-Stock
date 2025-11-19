const API_EMPLEADOS_URL = 'api_empleados.php';
const API_INVENTARIO_URL = 'api_inventario.php';
const API_CITAS_URL = 'api_citas.php';
const API_PROVEEDORES_URL = 'api_proveedores.php';
const API_MANTENIMIENTO_URL = 'api_mantenimiento.php';
const API_USUARIOS_URL = 'api_usuarios.php';

const SALARY_PER_HOUR = 45;

const availableTimeSlots = ['08:00', '09:00', '10:00', '11:00', '14:30', '15:30', '16:30', '17:30'];
const blockedTimes = {
    lunch: ['12:00', '13:00', '14:00'],
    shows: ['18:00', '19:00', '20:00', '21:00', '22:00'],
    sunday_afternoon: ['16:30', '17:30']
};

let users = {};
let currentUser = null;

let appointments = [];
let suppliers = [];
let employees = [];
let maintenanceReports = [];
let inventory = {
    bar: [],
    cafeteria: [],
    dulceria: [],
    cocina: []
};

let selectedTimeSlot = '';
let currentEmployeeSort = 'name';
let confirmActionCallback = null;

let inventoryModalInstance = null;
let employeeModalInstance = null;
let confirmationModalInstance = null;
let passwordModalInstance = null;

document.addEventListener('DOMContentLoaded', async () => {
    initializeModals();
    attachCoreEventListeners();

    try {
        await loadUsersFromDB();
    } catch (error) {
        showAlert(`Error CRÍTICO: No se pudieron cargar los datos de usuario. La aplicación no puede continuar. ${error.message}`, 'danger', 30000);
        const loginContainer = document.getElementById('login-container');
        if (loginContainer) loginContainer.innerHTML = `<p class="text-danger p-4">Error fatal al conectar con la base de datos de usuarios. Recargue la página o contacte al administrador.</p>`;
        showLoginContainer();
        return;
    }

    const storedRole = sessionStorage.getItem('currentUserRole');
    const storedName = sessionStorage.getItem('currentUserName');

    if (storedRole && storedName) {
        for (const username in users) {
            if (users[username].name === storedName && users[username].role === storedRole) {
                currentUser = users[username];
                break;
            }
        }

        if (currentUser) {
            showAppContainer();
            await initializeApp(currentUser);
        } else {
            sessionStorage.clear();
            showWelcomeContainer();
        }
    } else {
        showWelcomeContainer();
    }
});

async function initializeApp(user) {
    document.getElementById('nav-username').textContent = user.name;
    document.getElementById('nav-user-role').textContent = getRoleName(user.role);

    applyPermissions(user.role);
    setupDatePickers();
    initializeFormEventListeners();
    loadPasswordChangeForm();

    await loadAllDataFromBackend();

    updateDateTime();
    setInterval(updateDateTime, 1000);
}

function initializeModals() {
    const inventoryModalEl = document.getElementById('inventoryModal');
    if (inventoryModalEl) inventoryModalInstance = new bootstrap.Modal(inventoryModalEl);

    const employeeModalEl = document.getElementById('employeeModal');
    if (employeeModalEl) employeeModalInstance = new bootstrap.Modal(employeeModalEl);

    const confirmationModalEl = document.getElementById('confirmationModal');
    if (confirmationModalEl) confirmationModalInstance = new bootstrap.Modal(confirmationModalEl);

    const passwordModalEl = document.getElementById('passwordChangeModal');
    if (passwordModalEl) passwordModalInstance = new bootstrap.Modal(passwordModalEl);
}

function attachCoreEventListeners() {
    document.getElementById('goToLoginButton')?.addEventListener('click', showLoginContainer);
    document.getElementById('logoutButton')?.addEventListener('click', handleLogout);

    document.getElementById('loginForm')?.addEventListener('submit', handleLoginSubmit);
    document.getElementById('appointmentForm')?.addEventListener('submit', handleAppointmentSubmit);
    document.getElementById('supplierForm')?.addEventListener('submit', handleSupplierSubmit);
    document.getElementById('inventoryModalForm')?.addEventListener('submit', handleInventoryModalSubmit);
    document.getElementById('employeeModalForm')?.addEventListener('submit', handleEmployeeModalSubmit);
    document.getElementById('maintenanceForm')?.addEventListener('submit', handleMaintenanceSubmit);
    document.getElementById('passwordChangeForm')?.addEventListener('submit', handleChangePasswordSubmit);

    document.getElementById('confirmActionButton')?.addEventListener('click', () => {
        if (typeof confirmActionCallback === 'function') {
            confirmActionCallback();
        }
        if (confirmationModalInstance) confirmationModalInstance.hide();
    });
}

function initializeFormEventListeners() {
    document.getElementById('appointmentDate')?.addEventListener('change', generateTimeSlots);
    document.getElementById('supplierSearchInput')?.addEventListener('input', (e) => loadSuppliersList(e.target.value));

    ['general', 'bar', 'cafeteria', 'dulceria', 'cocina'].forEach(area => {
        document.getElementById(`search-${area}`)?.addEventListener('input', (e) => {
            if (area === 'general') renderGeneralInventoryTable(e.target.value);
            else renderInventoryTable(area, e.target.value);
        });
    });

    document.getElementById('sortByName')?.addEventListener('click', () => renderEmployeeTable('name'));
    document.getElementById('sortByHoursDesc')?.addEventListener('click', () => renderEmployeeTable('hours_desc'));
    document.getElementById('sortByHoursAsc')?.addEventListener('click', () => renderEmployeeTable('hours_asc'));

    document.getElementById('suppliersList')?.addEventListener('click', (e) => {
        const deleteButton = e.target.closest('.btn-delete-supplier');
        if (deleteButton) {
            const id = deleteButton.dataset.id;
            confirmDeleteSupplier(id);
        }
    });

    document.getElementById('employeesTableBody')?.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (!button) return;

        const id = button.dataset.id;
        if (button.classList.contains('btn-edit-employee')) {
            openEmployeeModal(id);
        } else if (button.classList.contains('btn-delete-employee')) {
            confirmDeleteEmployee(id);
        }
    });

    document.getElementById('general-inventory-body')?.addEventListener('click', (e) => {
        handleInventoryTableClick(e);
    });

    ['bar', 'cafeteria', 'dulceria', 'cocina'].forEach(area => {
        document.getElementById(`${area}-inventory-body`)?.addEventListener('click', (e) => {
            handleInventoryTableClick(e);
        });
    });
}

function handleInventoryTableClick(e) {
    const button = e.target.closest('button');
    if (!button) return;

    const id = button.dataset.id;
    const area = button.dataset.area;

    if (button.classList.contains('btn-edit-inventory')) {
        openInventoryModal(area, id);
    } else if (button.classList.contains('btn-delete-inventory')) {
        confirmDeleteInventoryItem(area, id);
    }
}

async function apiFetch(url, options = {}) {
    let response;
    let responseText;

    try {
        response = await fetch(url, options);
        responseText = await response.text();
    } catch (networkError) {
        console.error("Network error:", networkError);
        throw new Error(`Error de red: No se pudo conectar a ${url}. ¿Está el servidor PHP funcionando?`);
    }

    let result;
    try {
        result = JSON.parse(responseText);
    } catch (jsonError) {
        console.error("API response was not JSON:", responseText);
        const errorSnippet = responseText.replace(/<[^>]+>/g, ' ').substring(0, 200).trim();
        throw new Error(`El servidor falló (Respuesta no-JSON). Revisa el error de PHP: "${errorSnippet}..."`);
    }

    if (!response.ok || result.status === 'error') {
        throw new Error(result.mensaje || `Error ${response.status}: Error desconocido de la API.`);
    }

    return result;
}

async function loadAllDataFromBackend() {
    console.log("Loading all app data...");
    const dataLoads = [
        loadInventoryFromDB(),
        loadEmployeesFromDB(),
        loadSuppliersFromDB(),
        loadAppointmentsFromDB(),
        loadMaintenanceReportsFromDB()
    ];

    const results = await Promise.allSettled(dataLoads);

    results.forEach((result, index) => {
        if (result.status === 'rejected') {
            const loadName = ['Inventario', 'Empleados', 'Proveedores', 'Citas', 'Mantenimiento'][index];
            console.error(`Error cargando ${loadName}:`, result.reason);
            showAlert(`Error al cargar ${loadName}: ${result.reason.message}`, 'danger', 10000);
        }
    });

    console.log("All data loaded. Updating UI...");
    updateDashboard();
    console.log("UI updated after loading.");
}

async function loadUsersFromDB() {
    const result = await apiFetch(`${API_USUARIOS_URL}?accion=obtener`);
    if (result.data) {
        users = result.data;
        console.log("Users loaded successfully:", users);
    } else {
        throw new Error("No se recibieron datos de usuarios.");
    }
}

async function loadSuppliersFromDB() {
    try {
        const result = await apiFetch(`${API_PROVEEDORES_URL}?accion=obtener`);
        suppliers = result.data || [];
        console.log("Suppliers loaded:", suppliers);
    } catch (error) {
        console.error('Error in loadSuppliersFromDB:', error.message);
        showAlert(`Error al cargar proveedores: ${error.message}`, 'danger', 10000);
        suppliers = [];
    }
    loadSuppliersList();
    loadAppointmentForm();
}

async function loadAppointmentsFromDB() {
    try {
        const result = await apiFetch(`${API_CITAS_URL}?accion=obtener`);
        appointments = result.data || [];
        console.log("Appointments loaded:", appointments);
    } catch (error) {
        console.error('Error in loadAppointmentsFromDB:', error.message);
        showAlert(`Error al cargar citas: ${error.message}`, 'danger', 10000);
        appointments = [];
    }
    loadTodayAppointments();
    generateTimeSlots();
}

async function loadMaintenanceReportsFromDB() {
    try {
        const result = await apiFetch(`${API_MANTENIMIENTO_URL}?accion=obtener`);
        maintenanceReports = result.data || [];
        console.log("Maintenance Reports loaded:", maintenanceReports);
    } catch (error) {
        console.error('Error in loadMaintenanceReportsFromDB:', error.message);
        showAlert(`Error al cargar reportes: ${error.message}`, 'danger', 10000);
        maintenanceReports = [];
    }
    renderRecentMaintenanceReports();
}

async function loadInventoryFromDB() {
    try {
        const result = await apiFetch(`${API_INVENTARIO_URL}?accion=obtener`);
        inventory = { bar: [], cafeteria: [], dulceria: [], cocina: [] };
        (result.data || []).forEach(item => {
            if (inventory[item.area]) {
                item.id = parseInt(item.id, 10);
                item.product = item.nombre;
                item.category = item.categoria;
                item.unit = item.unidad;
                item.stock = parseInt(item.stock_actual, 10) || 0;
                item.minStock = parseInt(item.stock_minimo, 10) || 0;
                inventory[item.area].push(item);
            }
        });
        console.log("Inventory loaded:", inventory);
    } catch (error) {
        console.error('Error in loadInventoryFromDB:', error.message);
        showAlert(`Error al cargar inventario: ${error.message}`, 'danger', 10000);
        inventory = { bar: [], cafeteria: [], dulceria: [], cocina: [] };
    }
    renderGeneralInventoryTable();
    renderInventoryTable('bar');
    renderInventoryTable('cafeteria');
    renderInventoryTable('dulceria');
    renderInventoryTable('cocina');
    checkLowStock();
}

async function loadEmployeesFromDB() {
    try {
        const result = await apiFetch(`${API_EMPLEADOS_URL}?accion=obtener`);
        employees = result.data || [];
        employees.forEach(emp => {
            emp.id = parseInt(emp.id, 10);
            emp.name = emp.nombre;
            emp.position = emp.puesto;
            emp.hours = parseInt(emp.horas, 10) || 0;
        });
        console.log("Employees loaded:", employees);
    } catch (error) {
        console.error('Error in loadEmployeesFromDB:', error.message);
        showAlert(`Error al cargar empleados: ${error.message}`, 'danger', 10000);
        employees = [];
    }
    renderEmployeeTable();
}

async function handleLoginSubmit(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    const loginError = document.getElementById('loginError');
    loginError.style.display = 'none';

    if (users[username] && users[username].pass === pass) {
        currentUser = users[username];
        sessionStorage.setItem('currentUserRole', currentUser.role);
        sessionStorage.setItem('currentUserName', currentUser.name);

        showAppContainer();
        await initializeApp(currentUser);
    } else {
        loginError.textContent = 'Usuario o contraseña incorrectos.';
        loginError.style.display = 'block';
    }
}

function handleLogout() {
    sessionStorage.removeItem('currentUserRole');
    sessionStorage.removeItem('currentUserName');
    currentUser = null;
    window.location.reload();
}

function applyPermissions(role) {
    const roleMap = {
        'admin': ['appointments', 'suppliers', 'inventory', 'employees', 'forms', 'reports', 'admin-tools'],
        'manager': ['appointments', 'suppliers', 'inventory', 'employees', 'reports'],
        'warehouse': ['appointments', 'inventory', 'forms']
    };
    const allowedTabs = roleMap[role] || [];
    const navItems = document.querySelectorAll('#mainTabs > .nav-item');
    let firstVisibleTabButton = null;

    navItems.forEach(item => {
        const button = item.querySelector('button[data-bs-target]');
        if (button) {
            const targetId = button.getAttribute('data-bs-target').substring(1);
            if (allowedTabs.includes(targetId)) {
                item.style.display = '';
                if (!firstVisibleTabButton) {
                    firstVisibleTabButton = button;
                }
            } else {
                item.style.display = 'none';
            }
        }
    });

    const activeTabButton = document.querySelector('#mainTabs .nav-link.active');
    const parentNavItem = activeTabButton ? activeTabButton.closest('.nav-item') : null;

    if (!activeTabButton || (parentNavItem && parentNavItem.style.display === 'none')) {
        if (firstVisibleTabButton) {
            setTimeout(() => {
                try {
                    const tab = bootstrap.Tab.getOrCreateInstance(firstVisibleTabButton);
                    if (tab) tab.show();
                } catch (e) { console.error("Error activating tab:", e); }
            }, 0);
        }
    }
}

async function handleChangePasswordSubmit(e) {
    e.preventDefault();
    const username = document.getElementById('passwordUserSelect').value;
    const newPass = document.getElementById('newPassword').value;
    const confirmPass = document.getElementById('confirmPassword').value;

    if (newPass.length < 6) {
        showAlert('La contraseña debe tener al menos 6 caracteres.', 'warning');
        return;
    }
    if (newPass !== confirmPass) {
        showAlert('Las contraseñas no coinciden.', 'warning');
        return;
    }

    const formData = new FormData();
    formData.append('accion', 'cambiar_pass');
    formData.append('username', username);
    formData.append('new_password', newPass);

    try {
        const result = await apiFetch(API_USUARIOS_URL, { method: 'POST', body: formData });
        showAlert('Contraseña actualizada exitosamente.', 'success');
        users[username].pass = newPass;
        document.getElementById('passwordChangeForm').reset();
        if (passwordModalInstance) passwordModalInstance.hide();
    } catch (error) {
        console.error('Error en handleChangePasswordSubmit:', error);
        showAlert(`Error: ${error.message}.`, 'danger');
    }
}

function loadPasswordChangeForm() {
    const select = document.getElementById('passwordUserSelect');
    if (!select) return;
    select.innerHTML = '';
    for (const username in users) {
        const option = document.createElement('option');
        option.value = username;
        option.textContent = users[username].name;
        select.appendChild(option);
    }
}

function loadAppointmentForm() {
    const supplierSelect = document.getElementById('supplierSelect');
    if (!supplierSelect) return;

    if (suppliers.length > 0) {
        supplierSelect.innerHTML = '<option value="">Seleccionar proveedor...</option>';
        suppliers.forEach(supplier => {
            const option = document.createElement('option');
            option.value = supplier.id;
            option.textContent = `${supplier.nombre} - ${supplier.contacto}`;
            supplierSelect.appendChild(option);
        });
    } else {
        supplierSelect.innerHTML = '<option value="">No hay proveedores cargados...</option>';
    }

    generateTimeSlots();
    loadTodayAppointments();
}

function generateTimeSlots() {
    const dateInput = document.getElementById('appointmentDate');
    const slotsContainer = document.getElementById('timeSlots');
    if (!dateInput || !slotsContainer) return;

    const selectedDateStr = dateInput.value;
    slotsContainer.innerHTML = '';

    if (!selectedDateStr) {
        slotsContainer.innerHTML = '<p class="text-muted small">Selecciona una fecha.</p>';
        return;
    }
    if (new Date(selectedDateStr + 'T00:00:00') < new Date(getTodayString() + 'T00:00:00')) {
        slotsContainer.innerHTML = '<p class="text-danger small">No se pueden agendar citas en fechas pasadas.</p>';
        return;
    }

    const selectedDate = new Date(selectedDateStr + 'T00:00:00');
    const dayOfWeek = selectedDate.getUTCDay();
    let slotsGenerated = false;

    availableTimeSlots.forEach(time => {
        let isBlocked = false;
        if (blockedTimes.lunch.includes(time) || blockedTimes.shows.includes(time)) {
            isBlocked = true;
        }
        if (dayOfWeek === 0 && blockedTimes.sunday_afternoon.includes(time)) {
            isBlocked = true;
        }

        const isBooked = appointments.some(apt => apt.fecha === selectedDateStr && apt.hora === time);

        const slot = document.createElement('button');
        slot.type = 'button';
        slot.dataset.time = time;

        if (isBlocked || isBooked) {
            slot.className = 'btn btn-outline-secondary time-slot disabled';
            slot.disabled = true;
            slot.textContent = `${time} ${isBooked ? '(Ocupado)' : '(No disp.)'}`;
        } else {
            slot.className = 'btn btn-outline-success time-slot';
            slot.textContent = time;
            slot.addEventListener('click', () => selectTimeSlot(slot, time));
            slotsGenerated = true;
        }
        slotsContainer.appendChild(slot);
    });

    if (!slotsGenerated && !slotsContainer.innerHTML.includes('pasadas')) {
        slotsContainer.innerHTML = '<p class="text-warning small">No hay horarios disponibles para este día.</p>';
    }
}

function selectTimeSlot(element, time) {
    document.querySelectorAll('.time-slot').forEach(slot => {
        if (!slot.disabled) {
            slot.classList.remove('active', 'btn-success');
            slot.classList.add('btn-outline-success');
        }
    });
    element.classList.add('active', 'btn-success');
    element.classList.remove('btn-outline-success');
    selectedTimeSlot = time;
}

async function handleAppointmentSubmit(e) {
    e.preventDefault();
    const selectedDate = document.getElementById('appointmentDate').value;

    if (new Date(selectedDate + 'T00:00:00') < new Date(getTodayString() + 'T00:00:00')) {
        showAlert('No se puede agendar una cita en una fecha pasada.', 'danger');
        return;
    }
    if (!selectedTimeSlot) {
        showAlert('Por favor selecciona un horario', 'warning');
        return;
    }

    const formData = new FormData(e.target);
    formData.append('accion', 'guardar');
    formData.append('date', selectedDate);
    formData.append('time', selectedTimeSlot);
    formData.append('status', 'programada');

    try {
        const result = await apiFetch(API_CITAS_URL, { method: 'POST', body: formData });
        showAlert(result.mensaje || 'Cita agendada exitosamente', 'success');
        document.getElementById('appointmentForm').reset();
        selectedTimeSlot = '';
        setupDatePickers();
        await loadAppointmentsFromDB();
        updateDashboard();
    } catch (error) {
        console.error('Error en handleAppointmentSubmit:', error);
        showAlert(`Error al guardar: ${error.message}`, 'danger');
    }
}

function loadTodayAppointments() {
    const today = getTodayString();
    const container = document.getElementById('todayAppointments');
    if (!container) return;

    const todayAppts = appointments.filter(apt => apt.fecha === today);

    if (todayAppts.length === 0) {
        container.innerHTML = '<p class="text-muted small">No hay citas programadas para hoy</p>';
        return;
    }

    todayAppts.sort((a, b) => a.hora.localeCompare(b.hora));

    container.innerHTML = todayAppts.map(apt => {
        const supplier = suppliers.find(s => s.id == apt.id_proveedor);
        return `
            <div class="alert alert-info py-2 px-3 mb-2">
                <div class="fw-bold small">${apt.hora} - ${supplier ? supplier.nombre : 'ID: '+apt.id_proveedor}</div>
                <div class="small text-muted">${apt.tipo} - ${(apt.descripcion || '').substring(0,30)}...</div>
            </div>
        `;
    }).join('');
}

async function handleSupplierSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    formData.append('accion', 'guardar');

    try {
        const result = await apiFetch(API_PROVEEDORES_URL, { method: 'POST', body: formData });
        showAlert(result.mensaje || 'Proveedor agregado exitosamente', 'success');
        document.getElementById('supplierForm').reset();
        await loadSuppliersFromDB();
        updateDashboard();
    } catch (error) {
        console.error('Error en handleSupplierSubmit:', error);
        showAlert(`Error al guardar: ${error.message}`, 'danger');
    }
}

function loadSuppliersList(filter = '') {
    const container = document.getElementById('suppliersList');
    if (!container) return;

    const normalizedFilter = filter.toLowerCase();
    const filteredSuppliers = suppliers.filter(s =>
        (s.nombre?.toLowerCase() || '').includes(normalizedFilter) ||
        (s.contacto?.toLowerCase() || '').includes(normalizedFilter)
    );

    if (filteredSuppliers.length === 0) {
        container.innerHTML = '<p class="text-muted">No hay proveedores que coincidan.</p>';
        return;
    }

    container.innerHTML = `<ul class="list-group">${filteredSuppliers.map(supplier => `
        <li class="list-group-item">
            <div class="d-flex w-100 justify-content-between">
                <h6 class="mb-1">${supplier.nombre}</h6>
                <small>${supplier.especialidad}</small>
            </div>
            <p class="mb-1 small">${supplier.contacto || ''} | ${supplier.telefono || ''} | ${supplier.email || ''}</p>
            <button class="btn btn-sm btn-outline-danger float-end btn-delete-supplier" data-id="${supplier.id}">
                <i class="fas fa-trash"></i>
            </button>
        </li>
    `).join('')}</ul>`;
}

function confirmDeleteSupplier(id) {
    const supplier = suppliers.find(s => s.id == id);
    showConfirmationModal(
        'Eliminar Proveedor',
        `¿Está seguro de que desea eliminar a "${supplier?.nombre || id}"?`,
        () => { deleteSupplier(id); }
    );
}

async function deleteSupplier(id) {
    const formData = new FormData();
    formData.append('accion', 'eliminar');
    formData.append('id', id);

    try {
        const result = await apiFetch(API_PROVEEDORES_URL, { method: 'POST', body: formData });
        showAlert(result.mensaje || `Proveedor ${id} eliminado`, 'success');
        await loadSuppliersFromDB();
        updateDashboard();
    } catch (error) {
        console.error('Error en deleteSupplier:', error);
        showAlert(`Error al eliminar: ${error.message}`, 'danger');
    }
}

function renderInventoryTable(area, filter = '') {
    const tableBody = document.getElementById(`${area}-inventory-body`);
    if (!tableBody) return;

    const items = inventory[area] || [];
    const normalizedFilter = filter.toLowerCase();

    const filteredInventory = items.filter(p =>
        (p.product?.toLowerCase() || '').includes(normalizedFilter) ||
        (p.category?.toLowerCase() || '').includes(normalizedFilter)
    );

    tableBody.innerHTML = '';
    if (filteredInventory.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-muted text-center">No hay productos ${filter ? 'que coincidan' : 'en esta área'}.</td></tr>`;
        return;
    }

    filteredInventory.forEach(p => {
        const isLow = p.stock < p.minStock;
        const rowClass = isLow ? 'table-warning' : '';
        const stockClass = isLow ? 'text-danger fw-bold' : '';
        const row = document.createElement('tr');
        row.className = rowClass;
        row.innerHTML = `
            <td>${p.product}</td>
            <td>${p.category}</td>
            <td class="${stockClass}">${p.stock} ${p.unit}</td>
            <td>${p.minStock} ${p.unit}</td>
            <td>
                <button class="btn btn-sm btn-info btn-edit-inventory" data-area="${area}" data-id="${p.id}">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger ms-1 btn-delete-inventory" data-area="${area}" data-id="${p.id}">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function renderGeneralInventoryTable(filter = '') {
    const tableBody = document.getElementById('general-inventory-body');
    if (!tableBody) return;

    tableBody.innerHTML = '';
    let allProducts = [];
    const normalizedFilter = filter.toLowerCase();

    for (const area in inventory) {
        inventory[area].forEach(p => {
            allProducts.push({ ...p, area: area });
        });
    }

    const filteredProducts = allProducts.filter(p =>
        (p.product?.toLowerCase() || '').includes(normalizedFilter) ||
        (p.category?.toLowerCase() || '').includes(normalizedFilter) ||
        (p.area?.toLowerCase() || '').includes(normalizedFilter)
    );

    if (filteredProducts.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="text-muted text-center">No hay productos ${filter ? 'que coincidan' : ''}.</td></tr>`;
        return;
    }

    filteredProducts.forEach(p => {
        const isLow = p.stock < p.minStock;
        const rowClass = isLow ? 'table-warning' : '';
        const stockClass = isLow ? 'text-danger fw-bold' : '';
        const areaName = p.area.charAt(0).toUpperCase() + p.area.slice(1);
        const row = document.createElement('tr');
        row.className = rowClass;
        row.innerHTML = `
            <td>${areaName}</td>
            <td>${p.product}</td>
            <td>${p.category}</td>
            <td class="${stockClass}">${p.stock} ${p.unit}</td>
            <td>${p.minStock} ${p.unit}</td>
            <td>
                <button class="btn btn-sm btn-info btn-edit-inventory" data-area="${p.area}" data-id="${p.id}">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger ms-1 btn-delete-inventory" data-area="${p.area}" data-id="${p.id}">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function openInventoryModal(area, id = null) {
    const form = document.getElementById('inventoryModalForm');
    if (!form || !inventoryModalInstance) return;

    form.reset();
    document.getElementById('modalProductArea').value = area;

    if (id) {
        const product = inventory[area]?.find(p => p.id == id);
        if (!product) {
            showAlert(`Producto ID ${id} no encontrado en ${area}.`, 'danger');
            return;
        }
        document.getElementById('inventoryModalTitle').textContent = `Editar Producto en ${area}`;
        document.getElementById('modalProductId').value = id;
        document.getElementById('modalProductName').value = product.product || '';
        document.getElementById('modalProductCategory').value = product.category || '';
        document.getElementById('modalCurrentStock').value = product.stock ?? '';
        document.getElementById('modalMinStock').value = product.minStock ?? '';
        document.getElementById('modalProductUnit').value = product.unit || 'unidades';
    } else {
        document.getElementById('inventoryModalTitle').textContent = `Agregar Producto a ${area.charAt(0).toUpperCase() + area.slice(1)}`;
        document.getElementById('modalProductId').value = '';
    }

    inventoryModalInstance.show();
}

async function handleInventoryModalSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);

    const id = formData.get('modalProductId');
    const action = id ? 'actualizar' : 'guardar';
    formData.append('accion', action);

    formData.append('nombre', formData.get('modalProductName'));
    formData.append('categoria', formData.get('modalProductCategory'));
    formData.append('stock_actual', formData.get('modalCurrentStock'));
    formData.append('stock_minimo', formData.get('modalMinStock'));
    formData.append('unidad', formData.get('modalProductUnit'));
    formData.append('area', formData.get('modalProductArea'));

    try {
        const result = await apiFetch(API_INVENTARIO_URL, { method: 'POST', body: formData });
        showAlert(result.mensaje || `Producto ${id ? 'actualizado' : 'guardado'}`, 'success');
        inventoryModalInstance.hide();
        await loadInventoryFromDB();
        updateDashboard();
    } catch (error) {
        console.error(`Error en ${action} inventario:`, error);
        showAlert(`Error al ${action}: ${error.message}`, 'danger');
    }
}

function confirmDeleteInventoryItem(area, id) {
    const product = inventory[area]?.find(p => p.id == id);
    if (!product) {
        console.error(`No se pudo encontrar el producto ${id} en ${area} para confirmar eliminación.`);
        showAlert(`Error: Producto ${id} no encontrado.`, 'danger');
        return;
    }

    showConfirmationModal(
        'Eliminar Producto',
        `¿Está seguro de que desea eliminar "${product.product}" del área "${area}"?`,
        () => { deleteInventoryItem(id); }
    );
}

async function deleteInventoryItem(id) {
    const formData = new FormData();
    formData.append('accion', 'eliminar');
    formData.append('id', id);

    try {
        const result = await apiFetch(API_INVENTARIO_URL, { method: 'POST', body: formData });
        showAlert(result.mensaje || 'Producto eliminado.', 'success');
        await loadInventoryFromDB();
        updateDashboard();
    } catch (error) {
        console.error('Error al eliminar inventario:', error);
        showAlert(`Error al eliminar: ${error.message}`, 'danger');
    }
}

function renderEmployeeTable(sortBy = currentEmployeeSort) {
    currentEmployeeSort = sortBy;
    const tableBody = document.getElementById('employeesTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '';
    let sortedEmployees = [...employees];

    switch (sortBy) {
        case 'hours_desc':
            sortedEmployees.sort((a, b) => (b.hours || 0) - (a.hours || 0));
            break;
        case 'hours_asc':
            sortedEmployees.sort((a, b) => (a.hours || 0) - (b.hours || 0));
            break;
        case 'name':
        default:
            sortedEmployees.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            break;
    }

    if (sortedEmployees.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-muted text-center">No hay empleados registrados.</td></tr>';
        return;
    }

    sortedEmployees.forEach(emp => {
        const salary = (emp.hours || 0) * SALARY_PER_HOUR;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${emp.name || 'N/A'}</td>
            <td>${emp.position || 'N/A'}</td>
            <td>${emp.hours || 0}</td>
            <td>${formatCurrency(salary)}</td>
            <td>
                <button class="btn btn-sm btn-info btn-edit-employee" data-id="${emp.id}">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger ms-1 btn-delete-employee" data-id="${emp.id}">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function openEmployeeModal(id = null) {
    const form = document.getElementById('employeeModalForm');
    if (!form || !employeeModalInstance) return;

    form.reset();

    if (id) {
        const employee = employees.find(e => e.id == id);
        if (!employee) {
            showAlert(`Empleado ID ${id} no encontrado.`, 'danger');
            return;
        }
        document.getElementById('employeeModalTitle').textContent = 'Editar Empleado';
        document.getElementById('modalEmployeeId').value = employee.id;
        document.getElementById('modalEmployeeName').value = employee.name;
        document.getElementById('modalEmployeePosition').value = employee.position;
        document.getElementById('modalEmployeeHours').value = employee.hours;
    } else {
        document.getElementById('employeeModalTitle').textContent = 'Agregar Empleado';
        document.getElementById('modalEmployeeId').value = '';
    }
    employeeModalInstance.show();
}

async function handleEmployeeModalSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const id = formData.get('modalEmployeeId');
    const action = id ? 'actualizar' : 'guardar';
    formData.append('accion', action);

    formData.append('nombre', formData.get('modalEmployeeName'));
    formData.append('puesto', formData.get('modalEmployeePosition'));
    formData.append('horas', formData.get('modalEmployeeHours'));
    formData.append('id', id);

    try {
        const result = await apiFetch(API_EMPLEADOS_URL, { method: 'POST', body: formData });
        showAlert(result.mensaje || `Empleado ${id ? 'actualizado' : 'guardado'}.`, 'success');
        employeeModalInstance.hide();
        await loadEmployeesFromDB();
        updateDashboard();
    } catch (error) {
        console.error(`Error en ${action} empleado:`, error);
        showAlert(`Error al ${action}: ${error.message}`, 'danger');
    }
}

function confirmDeleteEmployee(id) {
    const employee = employees.find(e => e.id == id);
    if (!employee) return;

    showConfirmationModal(
        'Eliminar Empleado',
        `¿Está seguro de que desea eliminar a "${employee.name}"?`,
        () => { deleteEmployee(id); }
    );
}

async function deleteEmployee(id) {
    const formData = new FormData();
    formData.append('accion', 'eliminar');
    formData.append('id', id);

    try {
        const result = await apiFetch(API_EMPLEADOS_URL, { method: 'POST', body: formData });
        showAlert(result.mensaje || 'Empleado eliminado.', 'success');
        await loadEmployeesFromDB();
        updateDashboard();
    } catch (error) {
        console.error('Error al eliminar empleado:', error);
        showAlert(`Error al eliminar: ${error.message}`, 'danger');
    }
}

async function handleMaintenanceSubmit(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    formData.append('accion', 'guardar');
    formData.append('date', new Date().toISOString());

    formData.append('area', formData.get('maintArea'));
    formData.append('urgency', formData.get('maintUrgency'));
    formData.append('description', formData.get('maintDescription'));

    try {
        const result = await apiFetch(API_MANTENIMIENTO_URL, { method: 'POST', body: formData });
        showAlert(result.mensaje || 'Reporte de mantenimiento enviado.', 'success');
        document.getElementById('maintenanceForm').reset();
        await loadMaintenanceReportsFromDB();
    } catch (error) {
        console.error('Error en handleMaintenanceSubmit:', error);
        showAlert(`Error al guardar: ${error.message}`, 'danger');
    }
}

function renderRecentMaintenanceReports() {
    const container = document.getElementById('recentMaintenanceReports');
    if (!container) return;

    if (maintenanceReports.length === 0) {
        container.innerHTML = '<p class="text-muted small">No hay reportes recientes.</p>';
        return;
    }

    const sortedReports = [...maintenanceReports].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    const recent = sortedReports.slice(0, 5);

    container.innerHTML = `<ul class="list-group list-group-flush">${recent.map(r => {
        let badgeClass = 'bg-success';
        if (r.urgencia === 'media') badgeClass = 'bg-warning text-dark';
        if (r.urgencia === 'alta') badgeClass = 'bg-danger';
        const reportDate = new Date(r.fecha).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

        return `
            <li class="list-group-item d-flex justify-content-between align-items-center p-2">
                <div>
                    <strong class="d-block">${r.area}</strong>
                    <small class="text-muted">${reportDate}</small>
                    <small class="d-block">${(r.descripcion || '').substring(0, 40)}...</small>
                </div>
                <span class="badge ${badgeClass} text-uppercase">${r.urgencia}</span>
            </li>`;
    }).join('')}</ul>`;
}

function checkLowStock() {
    const alertsContainer = document.getElementById('stockAlerts');
    if (!alertsContainer) return;

    let lowStockItems = [];
    for (const area in inventory) {
        inventory[area].forEach(p => {
            if (p.stock < p.minStock) {
                lowStockItems.push({ ...p, area: area });
            }
        });
    }

    alertsContainer.innerHTML = '';
    const lowStockCountEl = document.getElementById('lowStockCount');
    if (lowStockCountEl) lowStockCountEl.textContent = lowStockItems.length;

    if (lowStockItems.length > 0) {
        alertsContainer.innerHTML = `
            <div class="alert alert-warning alert-dismissible fade show d-flex justify-content-between align-items-center" role="alert">
                <div>
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    <strong>Alerta:</strong> ${lowStockItems.length} producto(s) con stock bajo.
                    <button type="button" class="btn btn-sm btn-link p-0 ps-2" id="showLowStockDetailsButton" onclick="showLowStockDetails()">Ver detalles</button>
                </div>
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>`;
    }
}

function showLowStockDetails() {
    let details = "Productos con Stock Bajo:<br/><br/>";
    let found = false;
    for (const area in inventory) {
        inventory[area].forEach(p => {
            if (p.stock < p.minStock) {
                details += `- ${p.product} (${area}): ${p.stock}/${p.minStock} ${p.unit}<br/>`;
                found = true;
            }
        });
    }
    if (!found) details = "No hay productos con stock bajo actualmente.";
    showAlert(details, 'warning', 10000);
}

function updateDashboard() {
    console.log("Updating dashboard widgets...");

    document.getElementById('totalAppointments').textContent = appointments.length;
    document.getElementById('totalSuppliers').textContent = suppliers.length;

    let totalProducts = 0;
    let lowStockCount = 0;
    for (const area in inventory) {
        totalProducts += inventory[area].length;
        lowStockCount += inventory[area].filter(p => p.stock < p.minStock).length;
    }
    document.getElementById('totalProducts').textContent = totalProducts;
    document.getElementById('lowStockCount').textContent = lowStockCount;

    renderUpcomingAppointments();
}

function renderUpcomingAppointments() {
    const upcomingContainer = document.getElementById('upcomingAppointments');
    if (!upcomingContainer) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = appointments
        .filter(a => new Date(a.fecha + 'T00:00:00') >= today)
        .sort((a, b) => new Date(a.fecha + 'T' + a.hora) - new Date(b.fecha + 'T' + b.hora))
        .slice(0, 5);

    if (upcoming.length > 0) {
        upcomingContainer.innerHTML = `<ul class="list-group list-group-flush">${upcoming.map(apt => {
            const supplier = suppliers.find(s => s.id == apt.id_proveedor);
            return `<li class="list-group-item small">${apt.fecha} - ${apt.hora}: ${supplier ? supplier.nombre : 'ID '+apt.id_proveedor}</li>`;
        }).join('')}</ul>`;
    } else {
        upcomingContainer.innerHTML = `<p class="text-muted small">No hay citas próximas.</p>`;
    }
}

function generatePDFReport() {
    if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
        showAlert('Error al generar PDF: Librería jsPDF no cargada.', 'danger');
        console.error("jsPDF not loaded.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    if (typeof doc.autoTable === 'undefined') {
        showAlert('Error al generar PDF: Librería jsPDF-AutoTable no cargada.', 'danger');
        console.error("jsPDF-AutoTable not loaded (doc.autoTable is undefined).");
        return;
    }

    const reportType = document.getElementById('reportType').value;
    const fromDate = document.getElementById('reportFromDate').value || 'Inicio';
    const toDate = document.getElementById('reportToDate').value || 'Hoy';
    let title = '';
    let head = [];
    let body = [];
    const todayStr = getTodayString();

    doc.setFontSize(10);
    doc.text(`Periodo: ${fromDate} a ${toDate}`, 14, 26);
    doc.text(`Generado: ${todayStr}`, doc.internal.pageSize.width - 14, 26, { align: 'right' });

    switch (reportType) {
        case 'appointments':
            title = 'Citas Programadas';
            head = [['Fecha', 'Hora', 'Proveedor', 'Tipo', 'Descripción']];
            body = appointments
                .filter(a => (fromDate === 'Inicio' || a.fecha >= fromDate) && (toDate === 'Hoy' || a.fecha <= toDate))
                .map(a => {
                    const supplier = suppliers.find(s => s.id == a.id_proveedor);
                    return [a.fecha, a.hora, supplier ? supplier.nombre : `ID ${a.id_proveedor}`, a.tipo, a.descripcion];
                });
            break;
        case 'suppliers':
            title = 'Proveedores';
            head = [['Nombre', 'Contacto', 'Teléfono', 'Email', 'Especialidad']];
            body = suppliers.map(s => [s.nombre, s.contacto, s.telefono, s.email, s.especialidad]);
            break;
        case 'inventory':
            title = 'Inventario General';
            head = [['Área', 'Producto', 'Categoría', 'Stock', 'Mínimo', 'Unidad']];
            body = [];
            for (const area in inventory) {
                inventory[area].forEach(p => body.push([area, p.product, p.category, p.stock, p.minStock, p.unit]));
            }
            break;
        case 'lowstock':
            title = 'Stock Bajo';
            head = [['Área', 'Producto', 'Categoría', 'Actual', 'Mínimo', 'Unidad']];
            body = [];
            for (const area in inventory) {
                inventory[area]
                    .filter(p => p.stock < p.minStock)
                    .forEach(p => body.push([area, p.product, p.category, p.stock, p.minStock, p.unit]));
            }
            break;
        case 'payroll':
            title = 'Nómina Estimada';
            head = [['Nombre', 'Puesto', 'Horas/Mes', 'Salario Total']];
            body = employees.map(e => {
                const salary = (e.hours || 0) * SALARY_PER_HOUR;
                return [e.name, e.position, e.hours, formatCurrency(salary)];
            });
            break;
        case 'maintenance':
            title = 'Mantenimiento';
            head = [['Fecha', 'Área', 'Urgencia', 'Descripción']];
            body = maintenanceReports
                .filter(r => (fromDate === 'Inicio' || r.fecha.split('T')[0] >= fromDate) && (toDate === 'Hoy' || r.fecha.split('T')[0] <= toDate))
                .map(r => [new Date(r.fecha).toLocaleString('es-ES'), r.area, r.urgencia, r.descripcion]);
            break;
        default:
            showAlert('Tipo de reporte inválido', 'warning');
            return;
    }

    const mainTitle = `Reporte Cinemas WTC - ${title}`;
    doc.setFontSize(16);
    doc.text(mainTitle, 14, 20);

    doc.autoTable({
        startY: 30,
        head: head,
        body: body,
        theme: 'striped',
        headStyles: { fillColor: [0, 31, 63] },
        styles: { fontSize: 9 },
        didDrawPage: data => {
            doc.setFontSize(8);
            doc.text('Página ' + doc.internal.getNumberOfPages(), data.settings.margin.left, doc.internal.pageSize.height - 10);
        }
    });

    doc.save(`Reporte_${title.replace(/ /g, '_')}_${todayStr}.pdf`);
}

function showContainer(containerIdToShow) {
    const containers = ['welcome-container', 'login-container', 'app-container'];
    containers.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = (id === containerIdToShow) ? (id === 'app-container' ? 'block' : 'flex') : 'none';
        }
    });
}

function showWelcomeContainer() { showContainer('welcome-container'); }
function showLoginContainer() { showContainer('login-container'); }
function showAppContainer() { showContainer('app-container'); }

function showAlert(message, type = 'info', duration = 4000) {
    const alertPlaceholder = document.getElementById('alertPlaceholder');
    if (!alertPlaceholder) {
        console.error("No se encontró #alertPlaceholder");
        return;
    }
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
        <div class="alert alert-${type} alert-dismissible fade show shadow-sm" role="alert">
            <pre style="margin: 0; font-family: inherit; white-space: pre-wrap;">${message}</pre>
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>`;

    const alertElement = wrapper.firstChild;
    alertPlaceholder.appendChild(alertElement);

    setTimeout(() => {
        try {
            const bsAlert = bootstrap.Alert.getOrCreateInstance(alertElement);
            if (bsAlert) bsAlert.close();
        } catch (e) {
            if (alertElement && alertElement.parentNode) {
                alertElement.parentNode.removeChild(alertElement);
            }
        }
    }, duration);
}

function showConfirmationModal(title, message, callback) {
    if (!confirmationModalInstance) {
        console.error("Modal de confirmación no inicializado");
        return;
    }
    const modalTitle = document.getElementById('confirmationModalTitle');
    const modalBody = document.getElementById('confirmationModalBody');

    if (modalTitle) modalTitle.innerHTML = `<i class="fas fa-exclamation-triangle me-2 text-warning"></i> ${title}`;
    if (modalBody) modalBody.textContent = message;

    confirmActionCallback = callback;
    confirmationModalInstance.show();
}

function getTodayString() {
    return new Date().toISOString().split('T')[0];
}

function formatCurrency(value) {
    if (typeof value !== 'number') {
        value = 0;
    }
    return value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

function getRoleName(roleKey) {
    switch (roleKey) {
        case 'admin':
            return 'Administrador';
        case 'manager':
            return 'Gerente General';
        case 'warehouse':
            return 'Encargado de Almacén';
        default:
            return 'Usuario';
    }
}

function updateDateTime() {
    const now = new Date();
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
    const dateTimeEl = document.getElementById('currentDateTime');
    if (dateTimeEl) dateTimeEl.textContent = now.toLocaleString('es-MX', options);
}

function setupDatePickers() {
    const today = getTodayString();
    const appointmentDateInput = document.getElementById('appointmentDate');
    if (appointmentDateInput) {
        appointmentDateInput.min = today;
    }
    const reportFromDate = document.getElementById('reportFromDate');
    if (reportFromDate) reportFromDate.value = today;
    const reportToDate = document.getElementById('reportToDate');
    if (reportToDate) reportToDate.value = today;
}