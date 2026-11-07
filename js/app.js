const supabaseClient = window.pensionatoSupabase;
const publicSupabaseClient = window.pensionatoPublicSupabase;
const page = document.body.dataset.page;
const statusNotice = document.getElementById("app-status");
const HOUSE_PHOTO_BUCKET = "pensionato-uploads";
const HOUSE_PHOTO_MAX_SIZE = 10 * 1024 * 1024;
const HOUSE_PHOTO_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["image/avif", "avif"],
  ["image/heic", "heic"],
  ["image/heif", "heif"],
  ["image/bmp", "bmp"]
]);
let houses = [];
let selectedHouse = null;
let rooms = [];
let housePreviewObjectUrl = null;
let catalogHouses = [];
let catalogWhatsAppNumber = "";
let catalogSearchTerm = "";
let catalogRefreshInProgress = false;

function initializeTheme() {
  const storageKey = "pensionato-theme";
  let theme = "light";
  try {
    theme = localStorage.getItem(storageKey) || "light";
  } catch (error) {
    showStatus(`Não foi possível carregar a preferência de tema. ${error.message || ""}`, "warning");
  }
  document.documentElement.dataset.theme = theme === "dark" ? "dark" : "light";

  const button = makeElement("button", "button button-secondary theme-toggle");
  button.type = "button";
  const updateButton = () => {
    const isDark = document.documentElement.dataset.theme === "dark";
    button.textContent = isDark ? "☀ Modo claro" : "☾ Modo noturno";
    button.setAttribute("aria-pressed", String(isDark));
    button.setAttribute("aria-label", isDark ? "Ativar modo claro" : "Ativar modo noturno");
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = isDark ? "#101713" : "#e9ede9";
  };
  updateButton();

  button.addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    updateButton();
    try {
      localStorage.setItem(storageKey, nextTheme);
    } catch (error) {
      showStatus(`O tema foi alterado, mas não será salvo neste navegador. ${error.message || ""}`, "warning");
    }
  });

  const sidebar = document.querySelector(".sidebar");
  const publicHeader = document.querySelector(".public-header");
  if (sidebar) {
    const note = sidebar.querySelector(".sidebar-note");
    sidebar.insertBefore(button, note);
  } else if (publicHeader) {
    publicHeader.append(button);
  }
}

function showStatus(message, type = "warning") {
  if (!statusNotice) return;
  statusNotice.textContent = message;
  statusNotice.className = `notice notice-${type}`;
  statusNotice.hidden = false;
}

function clearStatus() {
  if (!statusNotice) return;
  statusNotice.textContent = "";
  statusNotice.hidden = true;
}

function formatCurrency(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(amount);
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function safeImageUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch {
    return "";
  }
}

function createImage(url, alt, className) {
  const safeUrl = safeImageUrl(url);
  if (!safeUrl) return makeElement("div", "image-placeholder", "Foto não informada");

  const image = makeElement("img", className);
  image.src = safeUrl;
  image.alt = alt;
  image.loading = "lazy";
  image.addEventListener("error", () => {
    image.replaceWith(makeElement("div", "image-placeholder", "Foto indisponível"));
  }, { once: true });
  return image;
}

function showLoadError(error) {
  const details = error && error.message ? ` Detalhes: ${error.message}` : "";
  showStatus(`Não foi possível carregar os dados do Supabase.${details}`, "error");
}

function showConfigurationState() {
  showStatus(window.pensionatoSupabaseError || "O cliente do Supabase não está configurado.");

  if (page === "dashboard") {
    document.getElementById("house-list").replaceChildren(
      makeElement("p", "empty-state", "Configure a conexão com o Supabase para carregar as casas.")
    );
  }

  if (page === "quartos") {
    document.getElementById("houses-list").replaceChildren(
      makeElement("p", "empty-state", "Configure a conexão com o Supabase para gerenciar as casas.")
    );
  }

  if (page === "catalog") {
    document.getElementById("catalog-houses").replaceChildren(
      makeElement("p", "empty-state", "O catálogo ainda não está configurado.")
    );
  }

  if (page === "inquilinos") {
    showAdminPageConfiguration("tenant-panel", "add-tenant-button");
  }

  if (page === "financeiro") {
    showAdminPageConfiguration("finance-content", "add-expense-button");
  }
}

function showAdminPageConfiguration(contentId, actionId) {
  const content = document.getElementById(contentId);
  const action = document.getElementById(actionId);
  if (content) content.hidden = true;
  if (action) action.disabled = true;
  showStatus(window.pensionatoSupabaseError || "O cliente do Supabase não está configurado.");
}

function getWhatsAppUrl(house) {
  const phone = catalogWhatsAppNumber.replace(/\D/g, "");
  if (!/^\d{10,15}$/.test(phone)) return "";

  const message = `Olá! Tenho interesse na casa ${house.nome}, no bairro ${house.bairro}. Ela ainda está disponível?`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

async function loadCatalog() {
  if (!publicSupabaseClient) {
    throw new Error("O cliente público do Supabase não foi inicializado.");
  }

  const [settingsResult, housesResult] = await Promise.all([
    publicSupabaseClient
      .from("configuracoes_publicas")
      .select("whatsapp_numero")
      .eq("id", 1)
      .maybeSingle(),
    publicSupabaseClient
      .from("casas")
      .select("id, nome, bairro, foto_url")
      .eq("disponivel", true)
      .order("nome", { ascending: true })
  ]);

  if (settingsResult.error) throw settingsResult.error;
  if (housesResult.error) throw housesResult.error;

  catalogWhatsAppNumber = settingsResult.data?.whatsapp_numero ?? "";
  catalogHouses = housesResult.data ?? [];
  if (catalogHouses.length) {
    const { data: availableRooms, error } = await publicSupabaseClient
      .from("quartos")
      .select("casa_id")
      .eq("disponivel", true)
      .in("casa_id", catalogHouses.map((house) => house.id));
    if (error) throw error;

    const roomCounts = new Map();
    (availableRooms ?? []).forEach(({ casa_id }) => {
      roomCounts.set(casa_id, (roomCounts.get(casa_id) ?? 0) + 1);
    });
    catalogHouses = catalogHouses
      .map((house) => ({
        ...house,
        quartos_count: roomCounts.get(house.id) ?? 0
      }))
      .filter((house) => house.quartos_count > 0);
  } else {
    catalogHouses = [];
  }
  renderCatalogHouses();

  const houseId = new URLSearchParams(window.location.search).get("casa");
  if (!houseId) return;
  if (catalogHouses.some((house) => String(house.id) === houseId)) {
    await openCatalogHouse(houseId, false);
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.delete("casa");
  window.history.replaceState({}, "", url);
  document.getElementById("catalog-detail").hidden = true;
  document.getElementById("catalog-view").hidden = false;
  showStatus("Esta casa não está mais disponível no catálogo.", "warning");
}

function renderCatalogHouses() {
  const list = document.getElementById("catalog-houses");
  const count = document.getElementById("catalog-count");
  const search = catalogSearchTerm.trim().toLocaleLowerCase("pt-BR");
  const filtered = catalogHouses.filter((house) =>
    `${house.nome} ${house.bairro}`.toLocaleLowerCase("pt-BR").includes(search)
  );

  list.replaceChildren();
  count.textContent = `${filtered.length} ${filtered.length === 1 ? "casa" : "casas"}`;

  if (!filtered.length) {
    list.append(makeElement(
      "p",
      "empty-state",
      catalogHouses.length
        ? "Nenhuma casa corresponde à sua busca."
        : "Ainda não há casas disponíveis. Volte em breve!"
    ));
    return;
  }

  filtered.forEach((house) => {
    const card = makeElement("article", "house-card public-house-card");
    card.append(createImage(house.foto_url, `Foto da casa ${house.nome}`, "house-card-image"));
    const content = makeElement("div", "house-card-content");
    const roomCount = house.quartos_count ?? 0;
    content.append(
      makeElement("p", "house-name", house.nome),
      makeElement("p", "house-address", `Bairro: ${house.bairro}`),
      makeElement("span", "house-neighborhood", `${house.bairro} · ${roomCount} ${roomCount === 1 ? "quarto disponível" : "quartos disponíveis"}`)
    );
    const openButton = makeElement("button", "button button-primary", "Conhecer casa");
    openButton.type = "button";
    openButton.addEventListener("click", () => openCatalogHouse(house.id));
    content.append(openButton);
    card.append(content);
    list.append(card);
  });
}

function renderCatalogHouse(house) {
  const container = document.getElementById("catalog-house");
  container.replaceChildren();
  container.append(createImage(house.foto_url, `Foto da casa ${house.nome}`, "house-detail-image"));

  const content = makeElement("div", "house-detail-content");
  const title = makeElement("h2", "", house.nome);
  title.id = "catalog-house-name";
  content.append(
    makeElement("p", "eyebrow", "CASA DISPONÍVEL"),
    title,
    makeElement("p", "house-detail-address", `Bairro: ${house.bairro}`)
  );
  container.append(content);

  const contactButton = document.getElementById("whatsapp-contact");
  const contactPanel = document.getElementById("contact-panel");
  const whatsappUrl = getWhatsAppUrl(house);
  contactButton.href = whatsappUrl || "#";
  contactButton.hidden = !whatsappUrl;
  contactButton.setAttribute("aria-disabled", whatsappUrl ? "false" : "true");
  contactPanel.classList.toggle("contact-unconfigured", !whatsappUrl);
  let contactMessage = contactPanel.querySelector(".contact-message");
  if (!whatsappUrl) {
    if (!contactMessage) {
      contactMessage = makeElement("p", "contact-message", "O responsável ainda não configurou o WhatsApp para contato.");
      contactPanel.querySelector("div").append(contactMessage);
    }
  } else {
    contactMessage?.remove();
  }
}

function renderCatalogRooms(roomList) {
  const list = document.getElementById("catalog-rooms");
  const count = document.getElementById("catalog-room-count");
  list.replaceChildren();
  count.textContent = `${roomList.length} ${roomList.length === 1 ? "quarto disponível" : "quartos disponíveis"}`;

  if (!roomList.length) {
    list.append(makeElement("p", "empty-state", "No momento, esta casa não tem quartos disponíveis."));
    return;
  }

  roomList.forEach((room) => {
    const card = makeElement("article", "room-card");
    if (room.foto_url) card.append(createImage(room.foto_url, `Foto do quarto ${room.numero}`, "room-card-image"));
    const content = makeElement("div", "room-card-content");
    const titleRow = makeElement("div", "room-card-title-row");
    titleRow.append(
      makeElement("h3", "", `Quarto ${room.numero}`),
      makeElement("span", "room-price", formatCurrency(room.valor_base))
    );
    const meta = makeElement("div", "room-meta");
    meta.append(
      makeElement("span", "room-tag", room.andar || "Andar não informado"),
      makeElement("span", "room-tag", room.tipo_mobilia || "Mobília não informada")
    );
    content.append(titleRow, meta);
    if (room.features) content.append(makeElement("p", "room-features", room.features));
    card.append(content);
    list.append(card);
  });
}

async function openCatalogHouse(houseId, updateUrl = true) {
  const house = catalogHouses.find((item) => String(item.id) === String(houseId));
  if (!house) {
    showStatus("Esta casa não está mais disponível.", "error");
    return;
  }

  clearStatus();
  document.getElementById("catalog-view").hidden = true;
  document.getElementById("catalog-detail").hidden = false;
  if (updateUrl) {
    const url = new URL(window.location.href);
    url.searchParams.set("casa", house.id);
    window.history.pushState({}, "", url);
  }

  renderCatalogHouse(house);
  document.getElementById("catalog-rooms").replaceChildren(
    makeElement("p", "empty-state", "Carregando quartos disponíveis...")
  );

  const { data, error } = await publicSupabaseClient
    .from("quartos")
    .select("id, casa_id, numero, andar, tipo_mobilia, valor_base, foto_url, features")
    .eq("casa_id", house.id)
    .eq("disponivel", true)
    .order("numero", { ascending: true });

  if (error) {
    showLoadError(error);
    renderCatalogRooms([]);
    return;
  }

  renderCatalogRooms(data ?? []);
}

function bindCatalogEvents() {
  document.getElementById("catalog-search").addEventListener("input", (event) => {
    catalogSearchTerm = event.currentTarget.value;
    renderCatalogHouses();
  });
  document.getElementById("catalog-back").addEventListener("click", () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("casa");
    window.history.pushState({}, "", url);
    document.getElementById("catalog-detail").hidden = true;
    document.getElementById("catalog-view").hidden = false;
    clearStatus();
  });
  window.addEventListener("popstate", () => {
    const houseId = new URLSearchParams(window.location.search).get("casa");
    if (!houseId) {
      document.getElementById("catalog-detail").hidden = true;
      document.getElementById("catalog-view").hidden = false;
    } else {
      openCatalogHouse(houseId, false);
    }
  });

  const refreshCatalog = async () => {
    if (catalogRefreshInProgress) return;
    catalogRefreshInProgress = true;
    try {
      await loadCatalog();
    } catch (error) {
      showLoadError(error);
    } finally {
      catalogRefreshInProgress = false;
    }
  };
  window.addEventListener("focus", refreshCatalog);
  window.setInterval(() => {
    if (!document.hidden) refreshCatalog();
  }, 60_000);
}

async function getCount(table) {
  const { count, error } = await supabaseClient
    .from(table)
    .select("id", { count: "exact", head: true });

  if (error) throw error;
  return count ?? 0;
}

async function loadDashboard() {
  const tables = [
    ["casas", "stat-casas"],
    ["quartos", "stat-quartos"],
    ["inquilinos", "stat-inquilinos"],
    ["despesas", "stat-despesas"]
  ];

  const counts = await Promise.all(tables.map(([table]) => getCount(table)));
  tables.forEach(([, elementId], index) => {
    document.getElementById(elementId).textContent = String(counts[index]);
  });

  const { data: casas, error } = await supabaseClient
    .from("casas")
    .select("id, nome, bairro, endereco, foto_url")
    .order("nome", { ascending: true });

  if (error) throw error;
  renderDashboardCasas(casas);
}

function renderDashboardCasas(casas) {
  const list = document.getElementById("house-list");
  list.replaceChildren();

  if (!casas.length) {
    list.append(makeElement("p", "empty-state", "Nenhuma casa cadastrada ainda."));
    return;
  }

  casas.forEach((casa) => {
    const item = makeElement("article", "house-item");
    const details = document.createElement("div");
    details.append(makeElement("p", "house-name", casa.nome));
    if (casa.endereco) details.append(makeElement("p", "house-address", casa.endereco));
    const link = makeElement("a", "text-link", "Ver quartos →");
    link.href = `quartos.html?casa=${encodeURIComponent(casa.id)}`;
    item.append(details, makeElement("span", "house-neighborhood", casa.bairro), link);
    list.append(item);
  });
}

async function loadHouses() {
  const { data, error } = await supabaseClient
    .from("casas")
    .select("id, nome, bairro, endereco, foto_url, criado_em, disponivel")
    .order("nome", { ascending: true });

  if (error) throw error;
  houses = data ?? [];
  renderHouses();
}

function renderHouses() {
  const list = document.getElementById("houses-list");
  list.replaceChildren();

  if (!houses.length) {
    list.append(makeElement("p", "empty-state", "Nenhuma casa cadastrada. Use “Nova casa” para começar."));
    return;
  }

  houses.forEach((house) => {
    const card = makeElement("article", "house-card");
    card.append(createImage(house.foto_url, `Foto da casa ${house.nome}`, "house-card-image"));
    const content = makeElement("div", "house-card-content");
    content.append(makeElement("p", "house-name", house.nome));
    content.append(makeElement("p", "house-address", house.endereco || house.bairro));
    const status = makeElement(
      "span",
      `availability-badge ${house.disponivel ? "is-available" : "is-unavailable"}`,
      house.disponivel ? "Disponível no catálogo" : "Oculta do catálogo"
    );
    const openButton = makeElement("button", "button button-secondary", "Ver quartos");
    openButton.type = "button";
    openButton.addEventListener("click", () => openHouse(house.id));
    const editButton = makeElement("button", "button button-secondary", "Editar casa");
    editButton.type = "button";
    editButton.addEventListener("click", () => openHouseForm(house));
    const actions = makeElement("div", "house-card-actions");
    actions.append(openButton, editButton);
    content.append(status, actions);
    card.append(content);
    list.append(card);
  });
}

function updateHouseUrl(houseId) {
  const url = new URL(window.location.href);
  if (houseId === null) url.searchParams.delete("casa");
  else url.searchParams.set("casa", houseId);
  window.history.pushState({}, "", url);
}

function makeUniqueFileId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();

  const randomValues = new Uint32Array(4);
  window.crypto.getRandomValues(randomValues);
  return [...randomValues].map((value) => value.toString(16).padStart(8, "0")).join("");
}

function getManagedHousePhotoPath(photoUrl) {
  if (!photoUrl || !supabaseClient) return null;

  const publicUrlPrefix = supabaseClient.storage
    .from(HOUSE_PHOTO_BUCKET)
    .getPublicUrl("")
    .data.publicUrl;

  try {
    const prefix = new URL(publicUrlPrefix);
    const candidate = new URL(photoUrl);
    if (candidate.origin !== prefix.origin || !candidate.pathname.startsWith(prefix.pathname)) return null;

    const path = decodeURIComponent(candidate.pathname.slice(prefix.pathname.length));
    return /^casas\/[0-9a-f-]+\.(jpg|png|webp|gif|avif|heic|heif|bmp)$/i.test(path) ? path : null;
  } catch {
    return null;
  }
}

async function uploadHousePhoto(file) {
  const extension = HOUSE_PHOTO_TYPES.get(file.type);
  if (!extension) {
    throw new Error("Escolha uma imagem JPG, PNG, WebP, GIF, AVIF, HEIC, HEIF ou BMP.");
  }
  if (file.size > HOUSE_PHOTO_MAX_SIZE) {
    throw new Error("A imagem precisa ter no máximo 10 MB.");
  }

  const path = `casas/${makeUniqueFileId()}.${extension}`;
  const { error } = await supabaseClient.storage
    .from(HOUSE_PHOTO_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false
    });

  if (error) {
    throw new Error(`Não foi possível enviar a foto. Verifique se o bucket "${HOUSE_PHOTO_BUCKET}" existe e se as permissões de upload estão configuradas. ${error.message}`);
  }

  const { data } = supabaseClient.storage
    .from(HOUSE_PHOTO_BUCKET)
    .getPublicUrl(path);

  return { path, publicUrl: data.publicUrl };
}

function releaseHousePhotoPreview() {
  if (!housePreviewObjectUrl) return;
  URL.revokeObjectURL(housePreviewObjectUrl);
  housePreviewObjectUrl = null;
}

function updateHousePhotoPreview(file, existingPhotoUrl = "") {
  const preview = document.getElementById("house-image-preview");
  const hint = document.getElementById("house-photo-hint");
  preview.replaceChildren();
  releaseHousePhotoPreview();

  const imageUrl = file ? URL.createObjectURL(file) : safeImageUrl(existingPhotoUrl);
  preview.hidden = !imageUrl;
  if (imageUrl) {
    const image = makeElement("img");
    image.alt = "Prévia da foto da casa";
    image.src = imageUrl;
    image.addEventListener("error", () => {
      image.replaceWith(makeElement("div", "image-placeholder", "Foto indisponível"));
    }, { once: true });
    preview.append(image);
    if (file) preview.append(makeElement("p", "image-preview-caption", file.name));
  }
  if (hint) {
    hint.textContent = existingPhotoUrl && !file
      ? "A foto atual será mantida se você não escolher outra imagem."
      : "Escolha uma imagem do celular ou computador. Formatos aceitos: JPG, PNG, WebP, GIF, AVIF, HEIC, HEIF e BMP; tamanho máximo: 10 MB. No cadastro, a foto é opcional.";
  }
}

async function openHouse(houseId, updateUrl = true) {
  const house = houses.find((item) => String(item.id) === String(houseId));
  if (!house) {
    showStatus("A casa selecionada não foi encontrada. Atualize a lista e tente novamente.", "error");
    return;
  }

  selectedHouse = house;
  if (updateUrl) updateHouseUrl(house.id);
  document.getElementById("house-view").hidden = true;
  document.getElementById("house-detail-view").hidden = false;
  clearStatus();
  renderSelectedHouse();

  try {
    await loadRooms(house.id);
  } catch (error) {
    showLoadError(error);
    renderRooms([]);
  }
}

function renderSelectedHouse() {
  const container = document.getElementById("selected-house");
  container.replaceChildren();
  container.append(createImage(selectedHouse.foto_url, `Foto da casa ${selectedHouse.nome}`, "house-detail-image"));

  const content = makeElement("div", "house-detail-content");
  const titleRow = makeElement("div", "house-detail-title-row");
  const title = makeElement("h2", "", selectedHouse.nome);
  title.id = "selected-house-name";
  const editButton = makeElement("button", "button button-secondary", "Editar dados da casa");
  editButton.type = "button";
  editButton.addEventListener("click", () => openHouseForm(selectedHouse));
  titleRow.append(title, editButton);

  content.append(
    makeElement("p", "eyebrow", "LOCALIZAÇÃO"),
    titleRow,
    makeElement("p", "house-detail-address", selectedHouse.endereco || "Endereço não informado"),
    makeElement("p", "house-detail-address", `Bairro: ${selectedHouse.bairro}`)
  );
  if (selectedHouse.endereco) {
    const mapLink = makeElement("a", "text-link", "Abrir localização no mapa →");
    mapLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selectedHouse.endereco}, ${selectedHouse.bairro}`)}`;
    mapLink.target = "_blank";
    mapLink.rel = "noopener noreferrer";
    content.append(mapLink);
  }
  content.append(makeElement(
    "span",
    `availability-badge ${selectedHouse.disponivel ? "is-available" : "is-unavailable"}`,
    selectedHouse.disponivel ? "Disponível no catálogo público" : "Indisponível no catálogo público"
  ));
  container.append(content);
}

async function loadRooms(houseId) {
  document.getElementById("quartos-list").replaceChildren(
    makeElement("p", "empty-state", "Carregando quartos...")
  );

  const { data, error } = await supabaseClient
    .from("quartos")
    .select("id, casa_id, numero, andar, tipo_mobilia, valor_base, foto_url, features, disponivel, leitos(id)")
    .eq("casa_id", houseId)
    .order("numero", { ascending: true });

  if (error) throw error;
  rooms = data ?? [];
  renderRooms(rooms);
}

function renderRooms(roomList) {
  const list = document.getElementById("quartos-list");
  const count = document.getElementById("quartos-count");
  list.replaceChildren();
  count.textContent = `${roomList.length} ${roomList.length === 1 ? "quarto" : "quartos"}`;

  if (!roomList.length) {
    list.append(makeElement("p", "empty-state", "Esta casa ainda não tem quartos cadastrados."));
    return;
  }

  roomList.forEach((room) => {
    const card = makeElement("article", "room-card");
    if (room.foto_url) card.append(createImage(room.foto_url, `Foto do quarto ${room.numero}`, "room-card-image"));
    const content = makeElement("div", "room-card-content");
    const titleRow = makeElement("div", "room-card-title-row");
    titleRow.append(
      makeElement("h3", "", `Quarto ${room.numero}`),
      makeElement("span", "room-price", formatCurrency(room.valor_base))
    );
    const meta = makeElement("div", "room-meta");
    meta.append(
      makeElement("span", "room-tag", room.andar || "Andar não informado"),
      makeElement("span", "room-tag", room.tipo_mobilia || "Mobília não informada"),
      makeElement("span", "room-tag", `${room.leitos?.length ?? 0} leitos`),
      makeElement("span", `availability-badge ${room.disponivel ? "is-available" : "is-unavailable"}`, room.disponivel ? "Disponível" : "Indisponível")
    );
    content.append(titleRow, meta);
    if (room.features) content.append(makeElement("p", "room-features", room.features));
    const editButton = makeElement("button", "button button-secondary", "Editar quarto");
    editButton.type = "button";
    editButton.addEventListener("click", () => openRoomForm(room));
    content.append(editButton);
    card.append(content);
    list.append(card);
  });
}

function openHouseForm(house = null) {
  const form = document.getElementById("house-form");
  form.reset();
  document.getElementById("house-id").value = house ? String(house.id) : "";
  document.getElementById("house-dialog-title").textContent = house ? "Editar casa" : "Nova casa";
  form.elements.namedItem("nome").value = house?.nome ?? "";
  form.elements.namedItem("bairro").value = house?.bairro ?? "";
  form.elements.namedItem("endereco").value = house?.endereco ?? "";
  form.elements.namedItem("disponivel").checked = house?.disponivel ?? false;
  updateHousePhotoPreview(null, house?.foto_url ?? "");
  document.getElementById("house-dialog").showModal();
  form.elements.namedItem("nome").focus();
}

function openRoomForm(room = null) {
  const form = document.getElementById("room-form");
  form.reset();
  document.getElementById("room-id").value = room ? String(room.id) : "";
  document.getElementById("room-dialog-title").textContent = room ? "Editar quarto" : "Novo quarto";
  form.elements.namedItem("numero").value = room?.numero ?? "";
  form.elements.namedItem("andar").value = room?.andar ?? "Térreo";
  form.elements.namedItem("tipo_mobilia").value = room?.tipo_mobilia ?? "Simples";
  form.elements.namedItem("valor_base").value = room?.valor_base ?? "0.00";
  form.elements.namedItem("foto_url").value = room?.foto_url ?? "";
  form.elements.namedItem("features").value = room?.features ?? "";
  form.elements.namedItem("disponivel").checked = room?.disponivel ?? false;
  document.getElementById("room-dialog").showModal();
  form.elements.namedItem("numero").focus();
}

async function saveHouse(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const id = document.getElementById("house-id").value;
  const values = new FormData(form);
  const photoFile = form.elements.namedItem("foto_file").files[0] ?? null;
  const payload = {
    nome: values.get("nome").trim(),
    bairro: values.get("bairro").trim(),
    endereco: values.get("endereco").trim() || null,
    disponivel: values.get("disponivel") === "on",
    foto_url: id
      ? houses.find((house) => String(house.id) === id)?.foto_url ?? selectedHouse?.foto_url ?? null
      : null
  };
  const previousPhotoUrl = payload.foto_url;
  if (photoFile && !HOUSE_PHOTO_TYPES.has(photoFile.type)) {
    showStatus("Escolha uma imagem JPG, PNG, WebP, GIF, AVIF, HEIC, HEIF ou BMP.", "error");
    return;
  }
  if (photoFile && photoFile.size > HOUSE_PHOTO_MAX_SIZE) {
    showStatus("A imagem precisa ter no máximo 10 MB.", "error");
    return;
  }

  const submitButton = form.querySelector('[type="submit"]');
  submitButton.disabled = true;
  let uploadedPhotoPath = null;

  try {
    if (photoFile) {
      const uploadedPhoto = await uploadHousePhoto(photoFile);
      uploadedPhotoPath = uploadedPhoto.path;
      payload.foto_url = uploadedPhoto.publicUrl;
    }

    const query = id
      ? supabaseClient.from("casas").update(payload).eq("id", id).select("id").maybeSingle()
      : supabaseClient.from("casas").insert(payload).select("id").single();
    const { data, error } = await query;
    if (error) throw error;
    if (!data) throw new Error("Casa não encontrada ou sem permissão para editá-la.");
  } catch (error) {
    let message = `Não foi possível salvar a casa. ${error.message || "Ocorreu um erro inesperado."}`;
    if (uploadedPhotoPath) {
      try {
        const { error: cleanupError } = await supabaseClient.storage
          .from(HOUSE_PHOTO_BUCKET)
          .remove([uploadedPhotoPath]);
        if (cleanupError) {
          message += ` Também não foi possível remover a foto enviada: ${cleanupError.message}`;
        }
      } catch (cleanupError) {
        message += ` Também não foi possível remover a foto enviada: ${cleanupError.message || "erro desconhecido."}`;
      }
    }
    showStatus(message, "error");
    return;
  } finally {
    submitButton.disabled = false;
  }

  document.getElementById("house-dialog").close();
  let refreshWarning = "";
  try {
    await loadHouses();
  } catch (error) {
    refreshWarning = ` A casa foi salva, mas a lista não pôde ser atualizada: ${error.message || "erro desconhecido."}`;
  }

  if (id && selectedHouse && String(selectedHouse.id) === id) {
    selectedHouse = houses.find((house) => String(house.id) === id) || { ...selectedHouse, ...payload };
    renderSelectedHouse();
  }

  let cleanupWarning = "";
  const previousPhotoPath = id ? getManagedHousePhotoPath(previousPhotoUrl) : null;
  if (uploadedPhotoPath && previousPhotoPath && previousPhotoPath !== uploadedPhotoPath) {
    try {
      const { error } = await supabaseClient.storage
        .from(HOUSE_PHOTO_BUCKET)
        .remove([previousPhotoPath]);
      if (error) cleanupWarning = ` A foto anterior não pôde ser removida: ${error.message}`;
    } catch (error) {
      cleanupWarning = ` A foto anterior não pôde ser removida: ${error.message || "erro desconhecido."}`;
    }
  }

  showStatus(
    `${id ? "Dados da casa atualizados." : "Casa cadastrada com sucesso."}${refreshWarning}${cleanupWarning}`,
    refreshWarning || cleanupWarning ? "warning" : "success"
  );
}

async function saveRoom(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const id = document.getElementById("room-id").value;
  const values = new FormData(form);
  const payload = {
    casa_id: selectedHouse.id,
    numero: values.get("numero").trim(),
    andar: values.get("andar").trim() || "Térreo",
    tipo_mobilia: values.get("tipo_mobilia").trim() || "Simples",
    valor_base: Number(values.get("valor_base")),
    foto_url: values.get("foto_url").trim() || null,
    features: values.get("features").trim() || null,
    disponivel: values.get("disponivel") === "on"
  };
  if (payload.foto_url && !safeImageUrl(payload.foto_url)) {
    showStatus("Informe uma URL de foto iniciada por http:// ou https://.", "error");
    return;
  }
  if (!Number.isFinite(payload.valor_base) || payload.valor_base < 0) {
    showStatus("O valor base precisa ser um número igual ou maior que zero.", "error");
    return;
  }
  const submitButton = form.querySelector('[type="submit"]');
  submitButton.disabled = true;

  try {
    const query = id
      ? supabaseClient.from("quartos").update(payload).eq("id", id).eq("casa_id", selectedHouse.id).select("id").maybeSingle()
      : supabaseClient.from("quartos").insert(payload).select("id").single();
    const { data, error } = await query;
    if (error) throw error;
    if (!data) throw new Error("Quarto não encontrado nesta casa ou sem permissão para editá-lo.");

    document.getElementById("room-dialog").close();
    await loadRooms(selectedHouse.id);
    showStatus(id ? "Quarto atualizado com sucesso." : "Quarto cadastrado com sucesso.", "success");
  } catch (error) {
    showLoadError(error);
  } finally {
    submitButton.disabled = false;
  }
}

async function showConfigurationStateForRooms() {
  showConfigurationState();
  document.getElementById("add-house-button").disabled = true;
  document.getElementById("add-room-button").disabled = true;
  document.getElementById("houses-list").replaceChildren(
    makeElement("p", "empty-state", "Configure a conexão com o Supabase para gerenciar as casas.")
  );
}

function userIsAdmin(user) {
  return user?.app_metadata?.role === "admin";
}

async function getAdminSession() {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) throw error;
  return data.session;
}

async function signOutAdmin() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) throw error;
  window.location.href = "admin.html";
}

async function loadAdminDashboard() {
  const [houseCount, roomCount, availableHouseCount, settingsResult] = await Promise.all([
    getCount("casas"),
    getCount("quartos"),
    supabaseClient.from("casas").select("id", { count: "exact", head: true }).eq("disponivel", true),
    supabaseClient
      .from("configuracoes_publicas")
      .select("whatsapp_numero")
      .eq("id", 1)
      .maybeSingle()
  ]);

  if (availableHouseCount.error) throw availableHouseCount.error;
  if (settingsResult.error) throw settingsResult.error;

  document.getElementById("admin-stat-casas").textContent = String(houseCount);
  document.getElementById("admin-stat-quartos").textContent = String(roomCount);
  document.getElementById("admin-stat-disponiveis").textContent = String(availableHouseCount.count ?? 0);
  document.querySelector('#whatsapp-settings-form [name="whatsapp_numero"]').value =
    settingsResult.data?.whatsapp_numero ?? "";
}

async function handleAdminSession(session) {
  const loginPanel = document.getElementById("admin-login-panel");
  const dashboard = document.getElementById("admin-dashboard");
  const signOutButton = document.getElementById("admin-signout");
  const adminUser = session?.user;

  signOutButton.hidden = !adminUser;
  if (!adminUser) {
    loginPanel.hidden = false;
    dashboard.hidden = true;
    return;
  }

  if (!userIsAdmin(adminUser)) {
    loginPanel.hidden = false;
    dashboard.hidden = true;
    showStatus("Este usuário não tem permissão de administrador. Atribua app_metadata.role = admin no Supabase.", "error");
    return;
  }

  loginPanel.hidden = true;
  dashboard.hidden = false;
  clearStatus();
  try {
    await loadAdminDashboard();
  } catch (error) {
    showStatus(`Não foi possível carregar o painel. Execute sql/marketplace-admin.sql no Supabase. ${error.message || ""}`, "error");
  }
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}

function localDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year").value;
  const month = parts.find((part) => part.type === "month").value;
  const day = parts.find((part) => part.type === "day").value;
  return `${year}-${month}-${day}`;
}

function getLocalMonthString(date = new Date()) {
  return localDateString(date).slice(0, 7);
}

function formatBrazilianMonth(month) {
  const [year, monthNumber] = month.split("-");
  return `${monthNumber}/${year}`;
}

function getFinanceMonthString() {
  const value = document.getElementById("finance-month").value.trim();
  const match = /^(0[1-9]|1[0-2])\/(\d{4})$/.exec(value);
  if (!match) throw new Error("Informe o mês de referência no formato MM/AAAA.");
  return `${match[2]}-${match[1]}`;
}

function setAdminSignOut() {
  const button = document.getElementById("admin-signout");
  button.hidden = false;
  button.addEventListener("click", async () => {
    try {
      await signOutAdmin();
    } catch (error) {
      showStatus(`Não foi possível encerrar a sessão. ${error.message || ""}`, "error");
    }
  });
}

async function guardAdminPage(contentId, actionIds = []) {
  const session = await getAdminSession();
  if (!session) {
    showStatus("Entre com sua conta de administrador pelo painel administrativo para continuar.");
    actionIds.forEach((id) => {
      const element = document.getElementById(id);
      if (element) element.disabled = true;
    });
    return false;
  }
  if (!userIsAdmin(session.user)) {
    showStatus("Esta conta não tem permissão de administrador.", "error");
    actionIds.forEach((id) => {
      const element = document.getElementById(id);
      if (element) element.disabled = true;
    });
    return false;
  }

  const content = document.getElementById(contentId);
  if (content) content.hidden = false;
  setAdminSignOut();
  return true;
}

function nullableFormValue(formData, name) {
  const value = formData.get(name);
  return value ? String(value).trim() || null : null;
}

function bindTenantFormEvents() {
  const modeSelect = document.getElementById("tenant-mode");
  const expenseRule = document.querySelector('#tenant-form [name="despesas_regra"]');
  const form = document.getElementById("tenant-form");

  modeSelect.addEventListener("change", () => {
    const isMonthly = modeSelect.value === "mensal";
    document.querySelectorAll(".monthly-field").forEach((field) => {
      field.hidden = !isMonthly;
      field.querySelector("input").required = isMonthly;
    });
    document.getElementById("tenant-rate-label").textContent =
      isMonthly ? "Aluguel mensal (R$) *" : "Valor por noite (R$) *";
  });

  expenseRule.addEventListener("change", () => {
    const details = document.getElementById("expense-rule-details");
    details.hidden = expenseRule.value !== "outra";
  });

  form.addEventListener("submit", saveTenantOccupancy);
  document.getElementById("add-tenant-button").addEventListener("click", async () => {
    try {
      await loadTenantRoomOptions();
      form.reset();
      modeSelect.dispatchEvent(new Event("change"));
      document.getElementById("expense-rule-details").hidden = true;
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      form.elements.namedItem("data_inicio").value = localDateString(tomorrow);
      const monthLater = new Date(tomorrow);
      monthLater.setMonth(monthLater.getMonth() + 6);
      form.elements.namedItem("data_fim").value = localDateString(monthLater);
      document.getElementById("tenant-dialog").showModal();
      form.elements.namedItem("nome").focus();
    } catch (error) {
      showLoadError(error);
    }
  });

  document.querySelectorAll('[data-close-dialog="tenant-dialog"]').forEach((button) => {
    button.addEventListener("click", () => document.getElementById("tenant-dialog").close());
  });
}

async function loadTenantRoomOptions() {
  const select = document.getElementById("tenant-room-select");
  const { data, error } = await supabaseClient
    .from("quartos")
    .select("id, numero, casas(nome, bairro)")
    .order("numero", { ascending: true });
  if (error) throw error;

  select.replaceChildren(makeElement("option", "", "Selecione um quarto"));
  select.options[0].value = "";
  (data ?? []).forEach((room) => {
    const house = Array.isArray(room.casas) ? room.casas[0] : room.casas;
    const option = makeElement(
      "option",
      "",
      `${house?.nome || "Casa"} · Quarto ${room.numero}${house?.bairro ? ` · ${house.bairro}` : ""}`
    );
    option.value = String(room.id);
    select.append(option);
  });

  if (!data?.length) {
    select.replaceChildren(makeElement("option", "", "Cadastre um quarto antes de criar a locação"));
    select.options[0].value = "";
  }
}

async function loadTenantOccupancies() {
  const { data, error } = await supabaseClient
    .from("locacoes")
    .select("id, modalidade, data_inicio, data_fim, valor, despesas_regra, despesas_descricao, status, inquilinos(nome, telefone, email), quartos(numero, casas(nome))")
    .eq("status", "ativa")
    .order("data_inicio", { ascending: false });
  if (error) throw error;

  const today = localDateString();
  const currentOrUpcoming = (data ?? []).filter((occupancy) =>
    occupancy.modalidade === "diaria"
      ? occupancy.data_fim > today
      : occupancy.data_fim >= today
  );
  renderTenantOccupancies(currentOrUpcoming);
}

function renderTenantOccupancies(occupancies) {
  const tableBody = document.getElementById("tenant-list");
  const count = document.getElementById("tenant-count");
  tableBody.replaceChildren();
  count.textContent = `${occupancies.length} ${occupancies.length === 1 ? "locação" : "locações"}`;

  if (!occupancies.length) {
    const row = document.createElement("tr");
    const cell = makeElement("td", "empty-state", "Nenhuma locação ativa. Cadastre uma para começar a controlar os recebimentos.");
    cell.colSpan = 7;
    row.append(cell);
    tableBody.append(row);
    return;
  }

  occupancies.forEach((occupancy) => {
    const tenant = Array.isArray(occupancy.inquilinos) ? occupancy.inquilinos[0] : occupancy.inquilinos;
    const room = Array.isArray(occupancy.quartos) ? occupancy.quartos[0] : occupancy.quartos;
    const house = Array.isArray(room?.casas) ? room.casas[0] : room?.casas;
    const row = document.createElement("tr");
    const renterCell = makeElement("td");
    renterCell.append(makeElement("strong", "table-primary-text", tenant?.nome || "Inquilino"));
    if (tenant?.telefone) renterCell.append(makeElement("small", "table-secondary-text", tenant.telefone));
    const locationCell = makeElement("td");
    locationCell.append(makeElement("strong", "table-primary-text", house?.nome || "Casa"));
    locationCell.append(makeElement("small", "table-secondary-text", `Quarto ${room?.numero || "—"}`));
    const ruleLabels = {
      incluidas: "Inclusas",
      rateio: "Rateio igual",
      outra: occupancy.despesas_descricao || "Outra forma"
    };
    const closeButton = makeElement("button", "button button-secondary button-small", "Encerrar");
    closeButton.type = "button";
    closeButton.addEventListener("click", () => endTenantOccupancy(occupancy));
    const cells = [
      renterCell,
      locationCell,
      makeElement("td", "", occupancy.modalidade === "mensal" ? "Mensal" : "Diária"),
      makeElement("td", "", `${formatCurrency(occupancy.valor)}${occupancy.modalidade === "diaria" ? " / noite" : " / mês"}`),
      makeElement("td", "", `${formatDate(occupancy.data_inicio)} – ${formatDate(occupancy.data_fim)}`),
      makeElement("td", "", ruleLabels[occupancy.despesas_regra] || "—"),
      makeElement("td")
    ];
    cells[0].className = "";
    cells[1].className = "";
    cells[6].append(closeButton);
    cells.forEach((cell) => {
      if (cell.tagName !== "TD") {
        const wrapper = makeElement("td");
        wrapper.append(cell);
        row.append(wrapper);
      } else {
        row.append(cell);
      }
    });
    tableBody.append(row);
  });
}

async function saveTenantOccupancy(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = new FormData(form);
  const start = values.get("data_inicio");
  const end = values.get("data_fim");
  const rate = Number(values.get("valor"));
  if (!start || !end || end <= start) {
    showStatus("A data final deve ser posterior à data inicial.", "error");
    return;
  }
  if (!Number.isFinite(rate) || rate <= 0) {
    showStatus("Informe um valor maior que zero.", "error");
    return;
  }
  if (values.get("modalidade") === "diaria") {
    const nights = Math.round((new Date(`${end}T00:00:00`) - new Date(`${start}T00:00:00`)) / 86400000);
    if (nights < 1) {
      showStatus("A locação diária precisa ter pelo menos uma noite.", "error");
      return;
    }
  }

  const tenant = {
    nome: String(values.get("nome")).trim(),
    telefone: String(values.get("telefone")).trim(),
    email: nullableFormValue(values, "email"),
    nascimento: nullableFormValue(values, "nascimento"),
    cpf: nullableFormValue(values, "cpf"),
    rg: nullableFormValue(values, "rg"),
    rg_data_expedicao: nullableFormValue(values, "rg_data_expedicao"),
    estado_civil: nullableFormValue(values, "estado_civil"),
    profissao: nullableFormValue(values, "profissao"),
    empresa_trabalho: nullableFormValue(values, "empresa_trabalho"),
    endereco: nullableFormValue(values, "endereco")
  };
  const occupancy = {
    quarto_id: Number(values.get("quarto_id")),
    modalidade: values.get("modalidade"),
    data_inicio: start,
    data_fim: end,
    valor: rate,
    dia_vencimento: values.get("modalidade") === "mensal" ? Number(values.get("dia_vencimento")) : 10,
    taxa_contrato: Number(values.get("taxa_contrato") || 0),
    forma_pagamento: values.get("forma_pagamento"),
    despesas_regra: values.get("despesas_regra"),
    despesas_descricao: nullableFormValue(values, "despesas_descricao"),
    multa_percentual: Number(values.get("multa_percentual") || 0),
    juros_percentual: Number(values.get("juros_percentual") || 0),
    aviso_rescisao_dias: Number(values.get("aviso_rescisao_dias") || 0),
    fiador_nome: nullableFormValue(values, "fiador_nome"),
    fiador_nascimento: nullableFormValue(values, "fiador_nascimento"),
    fiador_cpf: nullableFormValue(values, "fiador_cpf"),
    fiador_rg: nullableFormValue(values, "fiador_rg"),
    fiador_telefone: nullableFormValue(values, "fiador_telefone"),
    fiador_estado_civil: nullableFormValue(values, "fiador_estado_civil"),
    fiador_profissao: nullableFormValue(values, "fiador_profissao"),
    fiador_endereco: nullableFormValue(values, "fiador_endereco"),
    fiador_conjuge_nome: nullableFormValue(values, "fiador_conjuge_nome"),
    fiador_conjuge_cpf: nullableFormValue(values, "fiador_conjuge_cpf")
  };
  if (!occupancy.quarto_id || !Number.isFinite(occupancy.taxa_contrato) || occupancy.taxa_contrato < 0) {
    showStatus("Selecione um quarto e confira a taxa de contrato.", "error");
    return;
  }

  const submitButton = form.querySelector('[type="submit"]');
  submitButton.disabled = true;
  try {
    const { data, error } = await supabaseClient.rpc("criar_locacao_financeira", {
      p_inquilino: tenant,
      p_locacao: occupancy
    });
    if (error) throw error;
    if (!data?.locacao_id) throw new Error("O banco não retornou o identificador da locação.");

    document.getElementById("tenant-dialog").close();
    await loadTenantOccupancies();
    showStatus(`Locação registrada. ${data.cobrancas_geradas} cobrança(s) criada(s) automaticamente. O contrato formal continua sendo tratado fora do sistema.`, "success");
  } catch (error) {
    showStatus(`Não foi possível cadastrar a locação. ${error.message || ""}`, "error");
  } finally {
    submitButton.disabled = false;
  }
}

async function endTenantOccupancy(occupancy) {
  if (!window.confirm("Encerrar esta locação e cancelar cobranças futuras ainda pendentes?")) return;
  const today = localDateString();
  try {
    const { data, error } = await supabaseClient.rpc("encerrar_locacao_financeira", {
      p_locacao_id: occupancy.id,
      p_data_corte: today
    });
    if (error) throw error;
    await loadTenantOccupancies();
    const canceledCount = Number(data?.cobrancas_canceladas || 0);
    showStatus(
      `Locação encerrada. ${canceledCount} cobrança(s) futura(s) pendente(s) cancelada(s).`,
      "success"
    );
  } catch (error) {
    showStatus(`Não foi possível encerrar a locação. ${error.message || ""}`, "error");
  }
}

async function initTenantPage() {
  if (!(await guardAdminPage("tenant-panel", ["add-tenant-button"]))) return;
  bindTenantFormEvents();
  document.getElementById("tenant-panel").hidden = false;
  document.getElementById("add-tenant-button").hidden = false;
  await loadTenantOccupancies();
}

function renderFinanceTransactions(receivables, expenses) {
  const body = document.getElementById("finance-entry-list");
  const rows = [
    ...receivables.map((item) => ({
      id: item.id,
      kind: "recebimento",
      description: item.descricao,
      category: item.categoria,
      amount: Number(item.valor),
      dueDate: item.data_vencimento,
      status: item.status,
      source: item
    })),
    ...expenses.map((item) => ({
      id: item.id,
      kind: "despesa",
      description: item.titulo,
      category: item.categoria,
      amount: Number(item.valor),
      dueDate: item.data_vencimento,
      status: item.status,
      source: item
    }))
  ].sort((a, b) => String(b.dueDate).localeCompare(String(a.dueDate)));
  body.replaceChildren();
  document.getElementById("finance-entry-count").textContent =
    `${rows.length} ${rows.length === 1 ? "movimentação" : "movimentações"}`;

  if (!rows.length) {
    const row = document.createElement("tr");
    const cell = makeElement("td", "empty-state", "Nenhuma movimentação neste mês.");
    cell.colSpan = 7;
    row.append(cell);
    body.append(row);
    return;
  }

  rows.forEach((item) => {
    const row = document.createElement("tr");
    const isPaid = item.status === "Pago";
    const isOverdue = item.status === "Pendente" && item.dueDate < localDateString();
    const kind = makeElement(
      "span",
      `transaction-kind ${item.kind === "recebimento" ? "kind-income" : "kind-expense"}`,
      item.kind === "recebimento" ? "Entrada" : "Saída"
    );
    const status = makeElement(
      "span",
      `transaction-status ${isPaid ? "status-paid" : isOverdue ? "status-overdue" : item.status === "Cancelado" ? "status-cancelled" : "status-pending"}`,
      isOverdue ? "Atrasado" : item.status
    );
    const descriptionCell = makeElement("td");
    descriptionCell.append(makeElement("strong", "table-primary-text", item.description));
    const categoryCell = makeElement("td", "transaction-category", String(item.category).replaceAll("_", " "));
    const actionCell = makeElement("td");

    if (!isPaid && item.status !== "Cancelado") {
      const button = makeElement("button", "button button-secondary button-small", "Marcar pago");
      button.type = "button";
      button.addEventListener("click", () => markFinanceEntryPaid(item));
      actionCell.append(button);
    } else {
      actionCell.textContent = item.status === "Pago" && item.source.data_pagamento
        ? formatDate(item.source.data_pagamento)
        : "—";
    }

    row.append(
      makeElement("td", "", ""),
      descriptionCell,
      categoryCell,
      makeElement("td", "money-cell", formatCurrency(item.amount)),
      makeElement("td", "", formatDate(item.dueDate)),
      makeElement("td", "").appendChild(status).parentElement,
      actionCell
    );
    row.firstElementChild.append(kind);
    body.append(row);
  });
}

function renderExpenseCategorySummary(expenses) {
  const container = document.getElementById("expense-category-summary");
  const totals = new Map();
  expenses.forEach((expense) => {
    totals.set(expense.categoria, (totals.get(expense.categoria) ?? 0) + Number(expense.valor));
  });
  const total = [...totals.values()].reduce((sum, amount) => sum + amount, 0);
  document.getElementById("expense-breakdown-total").textContent = formatCurrency(total);
  container.replaceChildren();

  if (!totals.size) {
    container.append(makeElement("p", "empty-state", "Nenhuma despesa neste mês."));
    return;
  }

  [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, amount]) => {
      const row = makeElement("div", "expense-category-row");
      const heading = makeElement("div", "expense-category-heading");
      heading.append(
        makeElement("span", "", category.replaceAll("_", " ")),
        makeElement("strong", "", formatCurrency(amount))
      );
      const track = makeElement("div", "expense-category-track");
      const fill = makeElement("span", "expense-category-fill");
      fill.style.width = `${total ? Math.max(2, amount / total * 100) : 0}%`;
      track.append(fill);
      row.append(heading, track);
      container.append(row);
    });
}

async function loadFinanceDashboard() {
  const month = getFinanceMonthString();
  const [receiptsResult, expensesResult] = await Promise.all([
    supabaseClient
      .from("recebimentos")
      .select("id, locacao_id, inquilino_id, categoria, descricao, valor, data_vencimento, mes_referencia, status, data_pagamento")
      .eq("mes_referencia", month),
    supabaseClient
      .from("despesas")
      .select("id, titulo, valor, categoria, tipo, status, mes_referencia, data_vencimento, data_pagamento, ratear")
      .eq("mes_referencia", month)
  ]);
  if (receiptsResult.error) throw receiptsResult.error;
  if (expensesResult.error) throw expensesResult.error;

  const receipts = receiptsResult.data ?? [];
  const expenses = expensesResult.data ?? [];
  const paidReceipts = receipts.filter((entry) => entry.status === "Pago");
  const pendingReceipts = receipts.filter((entry) => entry.status === "Pendente");
  const overdueReceipts = pendingReceipts.filter((entry) => entry.data_vencimento < localDateString());
  const paidExpenses = expenses.filter((entry) => entry.status === "Pago");
  const sum = (items) => items.reduce((total, entry) => total + Number(entry.valor || 0), 0);

  document.getElementById("finance-income-paid").textContent = formatCurrency(sum(paidReceipts));
  document.getElementById("finance-income-count").textContent =
    `${paidReceipts.length} ${paidReceipts.length === 1 ? "pagamento confirmado" : "pagamentos confirmados"}`;
  document.getElementById("finance-income-pending").textContent = formatCurrency(sum(pendingReceipts));
  document.getElementById("finance-overdue-count").textContent =
    `${pendingReceipts.length} pendentes · ${overdueReceipts.length} atrasadas`;
  document.getElementById("finance-expenses-paid").textContent = formatCurrency(sum(paidExpenses));
  document.getElementById("finance-expenses-count").textContent =
    `${paidExpenses.length} ${paidExpenses.length === 1 ? "despesa paga" : "despesas pagas"} · ${expenses.filter((entry) => entry.status === "Pendente").length} pendentes`;
  document.getElementById("finance-balance").textContent =
    formatCurrency(sum(paidReceipts) - sum(paidExpenses));
  renderExpenseCategorySummary(expenses);
  renderFinanceTransactions(receipts, expenses);
}

async function markFinanceEntryPaid(entry) {
  const today = localDateString();
  const table = entry.kind === "recebimento" ? "recebimentos" : "despesas";
  const payload = entry.kind === "recebimento"
    ? { status: "Pago", data_pagamento: today, atualizado_em: new Date().toISOString() }
    : { status: "Pago", data_pagamento: today, atualizado_em: new Date().toISOString() };

  try {
    const { data, error } = await supabaseClient
      .from(table)
      .update(payload)
      .eq("id", entry.id)
      .eq("status", "Pendente")
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("A movimentação não foi encontrada ou já foi atualizada.");
    await loadFinanceDashboard();
    showStatus("Pagamento registrado.", "success");
  } catch (error) {
    showStatus(`Não foi possível atualizar o pagamento. ${error.message || ""}`, "error");
  }
}

function bindExpenseFormEvents() {
  const form = document.getElementById("expense-form");
  const status = form.elements.namedItem("status");
  status.addEventListener("change", () => {
    const dateField = document.getElementById("expense-payment-date-field");
    dateField.hidden = status.value !== "Pago";
    if (status.value === "Pago" && !form.elements.namedItem("data_pagamento").value) {
      form.elements.namedItem("data_pagamento").value = localDateString();
    }
  });

  document.getElementById("add-expense-button").addEventListener("click", () => {
    let month;
    try {
      month = getFinanceMonthString();
    } catch (error) {
      showStatus(error.message, "error");
      return;
    }
    form.reset();
    const [year, monthNumber] = (month || getLocalMonthString()).split("-").map(Number);
    const currentDay = Number(localDateString().slice(-2));
    const dueDay = Math.min(currentDay, new Date(year, monthNumber, 0).getDate());
    form.elements.namedItem("data_vencimento").value =
      `${month || getLocalMonthString()}-${String(dueDay).padStart(2, "0")}`;
    document.getElementById("expense-payment-date-field").hidden = true;
    document.getElementById("expense-dialog").showModal();
    form.elements.namedItem("titulo").focus();
  });

  document.querySelectorAll('[data-close-dialog="expense-dialog"]').forEach((button) => {
    button.addEventListener("click", () => document.getElementById("expense-dialog").close());
  });

  form.addEventListener("submit", saveFinanceExpense);
}

async function saveFinanceExpense(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = new FormData(form);
  const amount = Number(values.get("valor"));
  if (!Number.isFinite(amount) || amount <= 0) {
    showStatus("Informe um valor maior que zero para a despesa.", "error");
    return;
  }

  const payload = {
    titulo: String(values.get("titulo")).trim(),
    categoria: values.get("categoria"),
    tipo: values.get("tipo"),
    valor: amount,
    data_vencimento: values.get("data_vencimento"),
    status: values.get("status"),
    data_pagamento: values.get("status") === "Pago"
      ? nullableFormValue(values, "data_pagamento") || localDateString()
      : null,
    ratear: values.get("ratear") === "on"
  };
  if (!payload.data_vencimento) {
    showStatus("Informe a data de vencimento da despesa.", "error");
    return;
  }

  const submitButton = form.querySelector('[type="submit"]');
  submitButton.disabled = true;
  try {
    const { data, error } = await supabaseClient.rpc("registrar_despesa_financeira", {
      p_despesa: payload
    });
    if (error) throw error;
    if (!data?.despesa_id) throw new Error("O banco não retornou o identificador da despesa.");
    document.getElementById("expense-dialog").close();
    await loadFinanceDashboard();
    const splitCount = Number(data.locacoes_rateadas || 0);
    showStatus(
      splitCount
        ? `Despesa registrada e rateada entre ${splitCount} locações.`
        : payload.ratear
          ? "Despesa registrada. Não havia locações ativas com rateio separado para receber a cobrança."
          : "Despesa registrada.",
      "success"
    );
  } catch (error) {
    showStatus(`Não foi possível registrar a despesa. ${error.message || ""}`, "error");
  } finally {
    submitButton.disabled = false;
  }
}

async function initFinancePage() {
  if (!(await guardAdminPage("finance-content", ["add-expense-button"]))) return;
  document.getElementById("finance-content").hidden = false;
  document.getElementById("add-expense-button").hidden = false;
  bindExpenseFormEvents();

  const monthInput = document.getElementById("finance-month");
  monthInput.value = formatBrazilianMonth(getLocalMonthString());
  monthInput.addEventListener("change", async () => {
    try {
      await loadFinanceDashboard();
      clearStatus();
    } catch (error) {
      showLoadError(error);
    }
  });
  await loadFinanceDashboard();
}

async function initAdmin() {
  document.getElementById("copy-admin-sql").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const sql = document.getElementById("admin-role-sql").textContent;
    try {
      await navigator.clipboard.writeText(sql);
      button.textContent = "SQL copiado";
      window.setTimeout(() => {
        button.textContent = "Copiar SQL";
      }, 2000);
    } catch (error) {
      showStatus(`Não foi possível copiar automaticamente. Selecione o SQL exibido e copie manualmente. ${error.message || ""}`, "error");
    }
  });

  document.getElementById("admin-login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = form.querySelector('[type="submit"]');
    const values = new FormData(form);
    submitButton.disabled = true;
    clearStatus();

    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: values.get("email").trim(),
        password: values.get("password")
      });
      if (error) throw error;
      if (!userIsAdmin(data.user)) {
        await supabaseClient.auth.signOut();
        throw new Error("Este usuário não tem permissão de administrador.");
      }
      form.reset();
      await handleAdminSession(data.session);
    } catch (error) {
      showStatus(`Não foi possível entrar. ${error.message || "Verifique suas credenciais."}`, "error");
    } finally {
      submitButton.disabled = false;
    }
  });

  document.getElementById("admin-signout").addEventListener("click", async () => {
    try {
      await signOutAdmin();
    } catch (error) {
      showStatus(`Não foi possível encerrar a sessão. ${error.message || ""}`, "error");
    }
  });

  document.getElementById("whatsapp-settings-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = form.querySelector('[type="submit"]');
    const number = new FormData(form).get("whatsapp_numero").replace(/\D/g, "");
    if (!/^\d{10,15}$/.test(number)) {
      showStatus("Informe o número com código do país e DDD, usando de 10 a 15 dígitos.", "error");
      return;
    }

    submitButton.disabled = true;
    try {
      const { error } = await supabaseClient
        .from("configuracoes_publicas")
        .upsert({ id: 1, whatsapp_numero: number, atualizado_em: new Date().toISOString() });
      if (error) throw error;
      form.elements.namedItem("whatsapp_numero").value = number;
      showStatus("Número do WhatsApp atualizado para todos os anúncios.", "success");
    } catch (error) {
      showStatus(`Não foi possível salvar o WhatsApp. ${error.message || ""}`, "error");
    } finally {
      submitButton.disabled = false;
    }
  });

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    window.setTimeout(() => {
      handleAdminSession(session).catch((error) => showLoadError(error));
    }, 0);
  });

  try {
    await handleAdminSession(await getAdminSession());
  } catch (error) {
    showStatus(`Não foi possível verificar a sessão. ${error.message || ""}`, "error");
  }
}

function bindAccommodationEvents() {
  document.getElementById("add-house-button").addEventListener("click", () => openHouseForm());
  document.getElementById("add-room-button").addEventListener("click", () => openRoomForm());
  document.getElementById("back-to-houses").addEventListener("click", () => {
    updateHouseUrl(null);
    selectedHouse = null;
    document.getElementById("house-detail-view").hidden = true;
    document.getElementById("house-view").hidden = false;
    clearStatus();
  });
  document.getElementById("house-form").addEventListener("submit", saveHouse);
  document.getElementById("room-form").addEventListener("submit", saveRoom);
  document.querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => document.getElementById(button.dataset.closeDialog).close());
  });
  const houseForm = document.getElementById("house-form");
  houseForm.elements.namedItem("foto_file").addEventListener("change", (event) => {
    const selectedFile = event.currentTarget.files[0] ?? null;
    const currentPhoto = selectedHouse?.foto_url ?? "";
    updateHousePhotoPreview(selectedFile, selectedFile ? "" : currentPhoto);
    clearStatus();
  });
  document.getElementById("house-dialog").addEventListener("close", releaseHousePhotoPreview);
  const signOutButton = document.getElementById("admin-signout");
  signOutButton.addEventListener("click", async () => {
    try {
      await signOutAdmin();
    } catch (error) {
      showStatus(`Não foi possível encerrar a sessão. ${error.message || ""}`, "error");
    }
  });

  window.addEventListener("popstate", () => {
    const houseId = new URLSearchParams(window.location.search).get("casa");
    if (!houseId) {
      selectedHouse = null;
      document.getElementById("house-detail-view").hidden = true;
      document.getElementById("house-view").hidden = false;
      clearStatus();
    } else {
      openHouse(houseId, false);
    }
  });
}

async function initAccommodations() {
  const session = await getAdminSession();
  if (!session) {
    showStatus("Entre com sua conta de administrador para gerenciar casas e quartos.");
    return;
  }
  if (!userIsAdmin(session.user)) {
    showStatus("Esta conta não tem permissão de administrador. Entre com uma conta autorizada.", "error");
    return;
  }

  document.getElementById("admin-signout").hidden = false;
  document.getElementById("house-view").hidden = false;
  bindAccommodationEvents();
  await loadHouses();
  const houseId = new URLSearchParams(window.location.search).get("casa");
  if (houseId) await openHouse(houseId, false);
}

async function start() {
  if (!supabaseClient) {
    if (page === "quartos") await showConfigurationStateForRooms();
    else if (page === "admin") showConfigurationState();
    else showConfigurationState();
    return;
  }

  try {
    if (page === "dashboard") await loadDashboard();
    if (page === "catalog") {
      bindCatalogEvents();
      await loadCatalog();
    }
    if (page === "admin") await initAdmin();
    if (page === "quartos") await initAccommodations();
    if (page === "inquilinos") await initTenantPage();
    if (page === "financeiro") await initFinancePage();
  } catch (error) {
    showLoadError(error);
    if (page === "dashboard") {
      document.getElementById("house-list").replaceChildren(
        makeElement("p", "empty-state", "Não foi possível carregar as casas.")
      );
    }
    if (page === "quartos") {
      document.getElementById("houses-list").replaceChildren(
        makeElement("p", "empty-state", "Não foi possível carregar as casas. Verifique a conexão e as permissões no Supabase.")
      );
    }
    if (page === "catalog") {
      document.getElementById("catalog-houses").replaceChildren(
        makeElement("p", "empty-state", "Não foi possível carregar os anúncios. Verifique se a migração do catálogo foi executada no Supabase.")
      );
    }
    if (page === "admin") {
      showStatus(`O painel precisa da migração do catálogo no Supabase. ${error.message || ""}`, "error");
    }
    if (page === "inquilinos") {
      const row = document.createElement("tr");
      const cell = makeElement("td", "empty-state", "Não foi possível carregar as locações. Execute sql/financeiro-locacoes.sql no Supabase.");
      cell.colSpan = 7;
      row.append(cell);
      document.getElementById("tenant-list").replaceChildren(row);
    }
    if (page === "financeiro") {
      const row = document.createElement("tr");
      const cell = makeElement("td", "empty-state", "Não foi possível carregar o financeiro. Execute sql/financeiro-locacoes.sql no Supabase.");
      cell.colSpan = 7;
      row.append(cell);
      document.getElementById("finance-entry-list").replaceChildren(row);
    }
  }
}

initializeTheme();
start();
