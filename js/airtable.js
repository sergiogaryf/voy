/* ============================================
   VOY — Airtable API Layer
   Todas las operaciones CRUD contra Airtable
   ============================================ */

const VoyDB = (() => {
  const BASE = 'https://api.airtable.com/v0';
  const token  = () => VOY_CONFIG.airtable.token;
  const baseId = () => VOY_CONFIG.airtable.baseId;

  const headers = () => ({
    Authorization: `Bearer ${token()}`,
    'Content-Type': 'application/json',
  });

  /* ── Core fetch ─────────────────────────── */
  async function request(path, options = {}) {
    const url = `${BASE}/${baseId()}/${path}`;
    const res = await fetch(url, { headers: headers(), ...options });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Airtable ${res.status}: ${err?.error?.message || res.statusText}`);
    }
    return res.json();
  }

  async function listAll(table, params = '') {
    let records = [], offset = null;
    do {
      const q = offset ? `${params}&offset=${offset}` : params;
      const data = await request(`${encodeURIComponent(table)}?${q}`);
      records.push(...data.records);
      offset = data.offset || null;
    } while (offset);
    return records;
  }

  /* ── Mappers ─────────────────────────────── */
  function mapWorker(rec) {
    const f = rec.fields;
    return {
      _recordId:    rec.id,
      id:           f.WorkerId,
      name:         f.Name         || '',
      avatar:       f.Avatar       || '',
      category:     f.Category     || '',
      categoryLabel:f.CategoryLabel|| '',
      rating:       f.Rating       || 0,
      reviews:      f.Reviews      || 0,
      distance:     f.Distance     || 0,
      priceMin:     f.PriceMin     || 0,
      priceMax:     f.PriceMax     || 0,
      priceUnit:    f.PriceUnit    || '',
      city:         f.City         || '',
      lat:          f.Lat          || 0,
      lng:          f.Lng          || 0,
      verified:     f.Verified     || false,
      available:    f.Available    || false,
      completedJobs:f.CompletedJobs|| 0,
      responseTime: f.ResponseTime || '',
      bio:          f.Bio          || '',
      skills:       f.Skills       ? f.Skills.split(',').map(s => s.trim()) : [],
      gallery:      f.Gallery      ? f.Gallery.split(',').map(s => s.trim()).filter(Boolean) : [],
      phone:        f.Phone        || '',
      email:        f.Email        || '',
      passwordHash: f.PasswordHash || '',
    };
  }

  function mapClient(rec) {
    const f = rec.fields;
    return {
      _recordId:    rec.id,
      id:           f.ClientId,
      name:         f.Name          || '',
      avatar:       f.Avatar        || '',
      city:         f.City          || '',
      memberSince:  f.MemberSince   || '',
      totalServices:f.TotalServices || 0,
      lat:          f.Lat           || 0,
      lng:          f.Lng           || 0,
      phone:        f.Phone         || '',
      email:        f.Email         || '',
      passwordHash: f.PasswordHash  || '',
      status:       f.Status        || 'active',
    };
  }

  function mapBooking(rec) {
    const f = rec.fields;
    return {
      _recordId:      rec.id,
      id:             f.BookingId     || '',
      clientId:       f.ClientId      || 0,
      workerId:       f.WorkerId      || 0,
      category:       f.Category      || '',
      service:        f.Service       || '',
      status:         f.Status        || 'pending',
      date:           f.Date          || '',
      time:           f.Time          || '',
      address:        f.Address       || '',
      price:          f.Price         || 0,
      commission:     f.Commission    || 0,
      rating:         f.Rating        || null,
      review:         f.Review        || null,
    };
  }

  function mapRequest(rec) {
    const f = rec.fields;
    return {
      _recordId:     rec.id,
      id:            f.ReqId          || '',
      clientName:    f.ClientName     || '',
      clientAvatar:  f.ClientAvatar   || '',
      clientRating:  f.ClientRating   || 0,
      service:       f.Service        || '',
      date:          f.Date           || '',
      time:          f.Time           || '',
      address:       f.Address        || '',
      estimatedPrice:f.EstimatedPrice || 0,
      clientId:      f.ClientId       || 0,
      isNew:         f.IsNew          || false,
      status:        f.Status         || 'pending',
      distance:      f.Distance       || 0,
      workerRecordId:f.WorkerRecordId || '',
    };
  }

  function mapVerification(rec) {
    const f = rec.fields;
    return {
      _recordId:        rec.id,
      id:               f.VerifId      || '',
      name:             f.WorkerName   || '',
      avatar:           f.Avatar       || '',
      category:         f.Category     || '',
      date:             f.RequestDate  || '',
      docs:             f.Docs ? f.Docs.split(',').map(s => s.trim()).filter(Boolean) : [],
      documents:        f.Documents    || [],   // Array de objetos {url, filename, id}
      status:           f.Status       || 'pending',
      workerRecordId:   f.WorkerRecordId || '',
    };
  }

  function mapQuotation(rec) {
    const f = rec.fields;
    return {
      _recordId:       rec.id,
      quoteId:         f.QuoteId          || '',
      bookingRecordId: f.BookingRecordId  || '',
      workerRecordId:  f.WorkerRecordId   || '',
      clientId:        f.ClientId         || 0,
      workerName:      f.WorkerName       || '',
      clientName:      f.ClientName       || '',
      clientEmail:     f.ClientEmail      || '',
      service:         f.Service          || '',
      status:          f.Status           || 'pending',
      laborRate:       f.LaborRate        || 0,
      laborHours:      f.LaborHours       || 0,
      laborTotal:      f.LaborTotal       || 0,
      materials:       f.Materials        ? JSON.parse(f.Materials) : [],
      materialsTotal:  f.MaterialsTotal   || 0,
      subtotal:        f.Subtotal         || 0,
      commissionRate:  f.CommissionRate   || 0.15,
      commission:      f.Commission       || 0,
      grandTotal:      f.GrandTotal       || 0,
      notes:           f.Notes            || '',
      createdAt:       f.CreatedAt        || '',
    };
  }

  function mapTransaction(rec) {
    const f = rec.fields;
    return {
      _recordId:  rec.id,
      id:         f.TxId        || '',
      date:       f.Date        || '',
      client:     f.ClientName  || '',
      worker:     f.WorkerName  || '',
      svc:        f.Service     || '',
      gross:      f.Gross       || 0,
      status:     f.Status      || 'completed',
    };
  }

  function mapMessage(rec) {
    const f = rec.fields;
    return {
      _recordId:      rec.id,
      conversationId: f.ConversationId || '',
      from:           f.From           || 'other',
      text:           f.Text           || '',
      time:           f.TimeStr        || '',
    };
  }

  /* ── Auth ───────────────────────────────── */
  async function getWorkerByEmail(email) {
    const formula = `LOWER({Email})="${email.toLowerCase()}"`;
    const records = await listAll('Workers', `filterByFormula=${encodeURIComponent(formula)}`);
    return records.length ? mapWorker(records[0]) : null;
  }

  async function getClientByEmail(email) {
    const formula = `LOWER({Email})="${email.toLowerCase()}"`;
    const records = await listAll('Clients', `filterByFormula=${encodeURIComponent(formula)}`);
    return records.length ? mapClient(records[0]) : null;
  }

  async function createWorkerAccount(data) {
    const nextId = Date.now() % 100000;
    const rec = await request('Workers', {
      method: 'POST',
      body: JSON.stringify({
        fields: {
          WorkerId:     nextId,
          Name:         data.name,
          Email:        data.email,
          PasswordHash: data.passwordHash,
          Phone:        data.phone        || '',
          City:         data.city         || 'Viña del Mar',
          Category:     data.category     || 'other',
          Available:    false,
          Verified:     false,
          Rating:       0,
          Reviews:      0,
          CompletedJobs:0,
          PriceMin:     0,
          PriceMax:     0,
          Bio:          '',
          Avatar:       `https://i.pravatar.cc/80?u=${data.email}`,
        },
      }),
    });
    return mapWorker(rec);
  }

  async function createClientAccount(data) {
    const nextId = Date.now() % 100000;
    const rec = await request('Clients', {
      method: 'POST',
      body: JSON.stringify({
        fields: {
          ClientId:     nextId,
          Name:         data.name,
          Email:        data.email,
          PasswordHash: data.passwordHash,
          Phone:        data.phone        || '',
          City:         data.city         || 'Viña del Mar',
          TotalServices:0,
          MemberSince:  new Date().toISOString().split('T')[0],
          Avatar:       `https://i.pravatar.cc/80?u=${data.email}`,
        },
      }),
    });
    return mapClient(rec);
  }

  async function updatePasswordHash(table, recordId, hash) {
    return request(`${table}/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify({ fields: { PasswordHash: hash } }),
    });
  }

  /* ── Workers ─────────────────────────────── */
  async function getWorkers(filters = {}) {
    let formula = '';
    if (filters.category && filters.category !== 'all') {
      formula = `{Category}="${filters.category}"`;
    }
    const params = formula ? `filterByFormula=${encodeURIComponent(formula)}` : '';
    const records = await listAll('Workers', params);
    return records.map(mapWorker);
  }

  async function getWorkerByRecordId(recordId) {
    const rec = await request(`Workers/${recordId}`);
    return mapWorker(rec);
  }

  async function updateWorker(recordId, fields) {
    const rec = await request(`Workers/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify({ fields }),
    });
    return mapWorker(rec);
  }

  async function updateWorkerAvailability(recordId, available) {
    return updateWorker(recordId, { Available: available });
  }

  async function saveWorkerProfile(recordId, data) {
    const fields = {};
    if (data.name)         fields.Name         = data.name;
    if (data.phone)        fields.Phone        = data.phone;
    if (data.email)        fields.Email        = data.email;
    if (data.city)         fields.City         = data.city;
    if (data.bio)          fields.Bio          = data.bio;
    if (data.priceMin)     fields.PriceMin     = Number(data.priceMin);
    if (data.priceMax)     fields.PriceMax     = Number(data.priceMax);
    if (data.skills)       fields.Skills       = Array.isArray(data.skills) ? data.skills.join(', ') : data.skills;
    return updateWorker(recordId, fields);
  }

  /* ── Clients ─────────────────────────────── */
  async function getClients() {
    const records = await listAll('Clients');
    return records.map(mapClient);
  }

  async function saveClientProfile(recordId, data) {
    const fields = {};
    if (data.name)         fields.Name         = data.name;
    if (data.phone)        fields.Phone        = data.phone;
    if (data.email)        fields.Email        = data.email;
    if (data.city)         fields.City         = data.city;
    if (data.passwordHash) fields.PasswordHash = data.passwordHash;
    const rec = await request(`Clients/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify({ fields }),
    });
    return mapClient(rec);
  }

  /* ── Bookings ────────────────────────────── */
  async function getBookings(filters = {}) {
    let formula = '';
    if (filters.status) formula = `{Status}="${filters.status}"`;
    const params = formula ? `filterByFormula=${encodeURIComponent(formula)}` : '';
    const records = await listAll('Bookings', params);
    return records.map(mapBooking);
  }

  async function createBooking(data) {
    const nextId = 'VOY-' + String(Date.now()).slice(-4);
    const commission = Math.round((data.price || 0) * 0.15);
    const rec = await request('Bookings', {
      method: 'POST',
      body: JSON.stringify({
        fields: {
          BookingId:  nextId,
          ClientId:   data.clientId   || 101,
          WorkerId:   data.workerId,
          Category:   data.category   || '',
          Service:    data.service    || '',
          Status:     'pending',
          Date:       data.date       || '',
          Time:       data.time       || '',
          Address:    data.address    || '',
          Price:      data.price      || 0,
          Commission: commission,
        },
      }),
    });
    return mapBooking(rec);
  }

  async function updateBookingStatus(recordId, status) {
    const rec = await request(`Bookings/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify({ fields: { Status: status } }),
    });
    return mapBooking(rec);
  }

  async function addBookingReview(recordId, rating, review) {
    const rec = await request(`Bookings/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify({ fields: { Rating: rating, Review: review } }),
    });
    return mapBooking(rec);
  }

  /* ── Requests ────────────────────────────── */
  async function getRequests(workerRecordId) {
    let formula = workerRecordId
      ? `{WorkerRecordId}="${workerRecordId}"`
      : '';
    const params = formula ? `filterByFormula=${encodeURIComponent(formula)}` : '';
    const records = await listAll('Requests', params);
    return records.map(mapRequest);
  }

  async function createRequest(data) {
    const rec = await request('Requests', {
      method: 'POST',
      body: JSON.stringify({
        fields: {
          ReqId:          'REQ-' + String(Date.now()).slice(-3),
          ClientName:     data.clientName     || '',
          ClientAvatar:   data.clientAvatar   || '',
          ClientRating:   data.clientRating   || 5,
          Service:        data.service        || '',
          Date:           data.date           || '',
          Time:           data.time           || '',
          Address:        data.address        || '',
          EstimatedPrice: data.estimatedPrice || 0,
          ClientId:       data.clientId       || 0,
          IsNew:          true,
          Status:         'pending',
          Distance:       data.distance       || 0,
          WorkerRecordId: data.workerRecordId || '',
        },
      }),
    });
    return mapRequest(rec);
  }

  async function updateRequest(recordId, fields) {
    const rec = await request(`Requests/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify({ fields }),
    });
    return mapRequest(rec);
  }

  async function updateRequestStatus(recordId, status) {
    return updateRequest(recordId, { Status: status, IsNew: false });
  }

  /* ── Verifications ───────────────────────── */
  async function getVerifications(status = '') {
    let formula = status ? `{Status}="${status}"` : '';
    const params = formula ? `filterByFormula=${encodeURIComponent(formula)}` : '';
    const records = await listAll('Verifications', params);
    return records.map(mapVerification);
  }

  async function updateVerification(recordId, status) {
    const rec = await request(`Verifications/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify({ fields: { Status: status } }),
    });
    return mapVerification(rec);
  }

  /* ── Transactions ────────────────────────── */
  async function getTransactions() {
    const records = await listAll('Transactions', 'sort[0][field]=Date&sort[0][direction]=desc');
    return records.map(mapTransaction);
  }

  async function createTransaction(data) {
    const rec = await request('Transactions', {
      method: 'POST',
      body: JSON.stringify({
        fields: {
          TxId:       'VOY-' + String(Date.now()).slice(-4),
          Date:       data.date        || new Date().toLocaleDateString('es-CL'),
          ClientName: data.clientName  || '',
          WorkerName: data.workerName  || '',
          Service:    data.service     || '',
          Gross:      data.gross       || 0,
          Status:     data.status      || 'completed',
        },
      }),
    });
    return mapTransaction(rec);
  }

  /* ── Messages ────────────────────────────── */
  async function getMessages(conversationId) {
    const formula = `{ConversationId}="${conversationId}"`;
    const records = await listAll('Messages',
      `filterByFormula=${encodeURIComponent(formula)}&sort[0][field]=Timestamp&sort[0][direction]=asc`
    );
    return records.map(mapMessage);
  }

  async function sendMessage(conversationId, from, text) {
    const now = new Date();
    const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;
    const rec = await request('Messages', {
      method: 'POST',
      body: JSON.stringify({
        fields: {
          ConversationId: conversationId,
          From:           from,
          Text:           text,
          TimeStr:        time,
          Timestamp:      now.toISOString(),
        },
      }),
    });
    return mapMessage(rec);
  }

  /* ── Stats (cálculo dinámico) ────────────── */
  async function getStats() {
    const [workers, clients, bookings, verifs] = await Promise.all([
      getWorkers(),
      getClients(),
      getBookings(),
      getVerifications('pending'),
    ]);
    const completed = bookings.filter(b => b.status === 'completed');
    const totalRevenue = completed.reduce((sum, b) => sum + (b.price || 0), 0);
    const ratings = workers.filter(w => w.rating > 0).map(w => w.rating);
    const avgRating = ratings.length ? (ratings.reduce((a,b) => a+b,0) / ratings.length) : 0;
    return {
      totalWorkers:          workers.length,
      totalClients:          clients.length,
      totalServices:         completed.length,
      avgRating:             Math.round(avgRating * 10) / 10,
      totalRevenue:          totalRevenue,
      pendingVerifications:  verifs.length,
    };
  }

  /* ── Favoritos (localStorage) ────────────── */
  function getFavorites() {
    try { return new Set(JSON.parse(localStorage.getItem('voy_favorites') || '[]')); }
    catch { return new Set(); }
  }

  function saveFavorites(set) {
    localStorage.setItem('voy_favorites', JSON.stringify([...set]));
  }

  function toggleFavoriteLocal(workerId) {
    const favs = getFavorites();
    if (favs.has(workerId)) favs.delete(workerId);
    else favs.add(workerId);
    saveFavorites(favs);
    return favs;
  }

  /* ── Verificación (upload docs) ─────────── */
  async function getVerificationByWorker(workerRecordId) {
    const formula = `{WorkerRecordId}="${workerRecordId}"`;
    const records = await listAll('Verifications', `filterByFormula=${encodeURIComponent(formula)}`);
    return records.length ? mapVerification(records[0]) : null;
  }

  async function createVerification(workerRecordId, workerData) {
    const rec = await request('Verifications', {
      method: 'POST',
      body: JSON.stringify({
        fields: {
          VerifId:        'VER-' + String(Date.now()).slice(-4),
          WorkerName:     workerData.name || '',
          Avatar:         workerData.avatar || '',
          Category:       workerData.categoryLabel || workerData.category || '',
          RequestDate:    new Date().toLocaleDateString('es-CL'),
          Status:         'pending',
          WorkerRecordId: workerRecordId,
          Docs:           '',
        },
      }),
    });
    return mapVerification(rec);
  }

  async function uploadVerificationDoc(verifRecordId, file) {
    // Usa Airtable Content API para subir archivo directamente
    const fieldId = 'fldvDVYNYBqRiDI4C'; // Documents field
    const url = `https://content.airtable.com/v0/${baseId()}/${verifRecordId}/${fieldId}/uploadAttachment`;
    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('filename', file.name);
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}` },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Upload failed: ${err?.error?.message || res.statusText}`);
    }
    return res.json();
  }

  async function updateVerificationDocs(recordId, docLabel) {
    // Actualiza el campo Docs (texto) con la lista de documentos subidos
    const rec = await request(`Verifications/${recordId}`);
    const existing = rec.fields.Docs ? rec.fields.Docs.split(',').map(s => s.trim()).filter(Boolean) : [];
    if (!existing.includes(docLabel)) existing.push(docLabel);
    return request(`Verifications/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify({ fields: { Docs: existing.join(', ') } }),
    });
  }

  /* ── Upload de avatar ────────────────────── */
  async function uploadAvatar(table, recordId, avatarFieldId, file) {
    // Convertir archivo a base64
    const fileBase64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    // Usar API serverless para evitar CORS
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table,
        recordId,
        fieldId: avatarFieldId,
        fileName: file.name,
        fileBase64,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Avatar upload failed: ${err?.error || err?.detail || res.statusText}`);
    }
    const data = await res.json();
    return data.url;
  }

  /* ── Suspender usuarios ──────────────────── */
  async function updateUserStatus(table, recordId, status) {
    return request(`${table}/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify({ fields: { Status: status } }),
    });
  }

  /* ── Eliminar registro ──────────────────── */
  async function deleteRecord(table, recordId) {
    return request(`${table}/${recordId}`, { method: 'DELETE' });
  }

  /* ── Quotations ─────────────────────────── */
  async function createQuotation(data) {
    const quoteId = 'QUO-' + String(Date.now()).slice(-6);
    const rec = await request('Quotations', {
      method: 'POST',
      body: JSON.stringify({
        fields: {
          QuoteId:         quoteId,
          BookingRecordId: data.bookingRecordId  || '',
          WorkerRecordId:  data.workerRecordId   || '',
          ClientId:        data.clientId          || 0,
          WorkerName:      data.workerName        || '',
          ClientName:      data.clientName        || '',
          ClientEmail:     data.clientEmail       || '',
          Service:         data.service           || '',
          Status:          'pending',
          LaborRate:       data.laborRate         || 0,
          LaborHours:      data.laborHours        || 0,
          LaborTotal:      data.laborTotal        || 0,
          Materials:       JSON.stringify(data.materials || []),
          MaterialsTotal:  data.materialsTotal    || 0,
          Subtotal:        data.subtotal          || 0,
          CommissionRate:  data.commissionRate     || 0.15,
          Commission:      data.commission        || 0,
          GrandTotal:      data.grandTotal        || 0,
          Notes:           data.notes             || '',
          CreatedAt:       new Date().toISOString(),
        },
      }),
    });
    return mapQuotation(rec);
  }

  async function getQuotationsByWorker(workerRecordId) {
    const formula = `{WorkerRecordId}="${workerRecordId}"`;
    const records = await listAll('Quotations', `filterByFormula=${encodeURIComponent(formula)}`);
    return records.map(mapQuotation);
  }

  async function getQuotationsByClient(clientId) {
    const formula = `{ClientId}=${clientId}`;
    const records = await listAll('Quotations', `filterByFormula=${encodeURIComponent(formula)}`);
    return records.map(mapQuotation);
  }

  async function getQuotationByBooking(bookingRecordId) {
    const formula = `{BookingRecordId}="${bookingRecordId}"`;
    const records = await listAll('Quotations', `filterByFormula=${encodeURIComponent(formula)}`);
    return records.length ? mapQuotation(records[0]) : null;
  }

  async function updateQuotationStatus(recordId, status) {
    const rec = await request(`Quotations/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify({ fields: { Status: status } }),
    });
    return mapQuotation(rec);
  }

  /* ── Exports públicos ────────────────────── */
  return {
    // Auth
    getWorkerByEmail, getClientByEmail,
    createWorkerAccount, createClientAccount, updatePasswordHash,
    // Workers
    getWorkers, getWorkerByRecordId, updateWorker,
    updateWorkerAvailability, saveWorkerProfile,
    // Clients
    getClients, saveClientProfile,
    // Bookings
    getBookings, createBooking, updateBookingStatus, addBookingReview,
    // Requests
    getRequests, createRequest, updateRequest, updateRequestStatus,
    // Verifications
    getVerifications, updateVerification,
    getVerificationByWorker, createVerification,
    uploadVerificationDoc, updateVerificationDocs,
    // Transactions
    getTransactions, createTransaction,
    // Messages
    getMessages, sendMessage,
    // Stats
    getStats,
    // Avatar upload
    uploadAvatar,
    // User status
    updateUserStatus,
    // Delete
    deleteRecord,
    // Favoritos
    getFavorites, saveFavorites, toggleFavoriteLocal,
    // Quotations
    createQuotation, getQuotationsByWorker, getQuotationsByClient,
    getQuotationByBooking, updateQuotationStatus,
  };
})();
