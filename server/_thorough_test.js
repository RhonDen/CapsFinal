// Thorough verification of all admin endpoints and the keep-alive/health system.
// Covers: login, dashboard, walk-in creation, walk-in pending outcome persistence,
// status update flow (completed / notCompleted), block dates CRUD, clients,
// history filters, inbox, analytics, and health/keep-alive.

const axios = require('axios');

const BASE = 'http://localhost:5000';
const cookieJar = {};

let PASS = 0;
let FAIL = 0;

function check(name, condition, detail = '') {
  if (condition) {
    PASS += 1;
    console.log(`  PASS: ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    FAIL += 1;
    console.log(`  FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function login() {
  const res = await axios.post(`${BASE}/api/admin/login`, {
    username: process.env.ADMIN_USER || 'admin',
    password: process.env.ADMIN_PASS || 'admin123',
  });
  const setCookie = res.headers['set-cookie'];
  if (setCookie && setCookie.length) {
    cookieJar.cookie = setCookie[0].split(';')[0];
  }
  return res.data;
}

async function get(url) {
  return axios.get(`${BASE}${url}`, { headers: { Cookie: cookieJar.cookie } });
}

async function post(url, body) {
  return axios.post(`${BASE}${url}`, body, { headers: { Cookie: cookieJar.cookie } });
}

async function patch(url, body) {
  return axios.patch(`${BASE}${url}`, body, { headers: { Cookie: cookieJar.cookie } });
}

async function del(url) {
  return axios.delete(`${BASE}${url}`, { headers: { Cookie: cookieJar.cookie } });
}

// Unique test identifiers so cleanup is easy
const TS = Date.now();
const TEST_SERVICE = 'Teeth Cleaning - 45 min';
// Valid PH mobile: 09XXXXXXXXX (11 digits) — walk-in accepts E.164, but OTP flow needs 09 format
const TEST_PHONE = `0917${String(TS).slice(-7)}`;

async function run() {
  console.log('=== 1. Admin Login ===');
  try {
    await login();
    check('Login succeeds', true);
  } catch (e) {
    check('Login succeeds', false, e.response?.data?.error || e.message);
    return;
  }

  console.log('\n=== 2. Check Auth ===');
  try {
    const res = await get('/api/admin/check-auth');
    check('check-auth returns authenticated', res.data?.authenticated === true);
  } catch (e) {
    check('check-auth returns authenticated', false, e.response?.data?.error || e.message);
  }

  console.log('\n=== 3. Health (keep-alive) ===');
  try {
    const res = await axios.get(`${BASE}/api/health`);
    check('Health endpoint works', res.status === 200 && res.data?.status === 'ok');
  } catch (e) {
    check('Health endpoint works', false, e.message);
  }

  console.log('\n=== 4. Dashboard (baseline) ===');
  let walkInId = null;
  try {
    const res = await get('/api/admin/dashboard');
    const data = res.data;
    check('Dashboard returns stats', data && typeof data.stats === 'object');
    check('Dashboard returns pendingAppointments array', Array.isArray(data.pendingAppointments));
    check('Dashboard returns pendingOutcomeAppointments array', Array.isArray(data.pendingOutcomeAppointments));
    check('Dashboard returns todayAppointments array', Array.isArray(data.todayAppointments));
    check('Dashboard returns upcomingAppointments array', Array.isArray(data.upcomingAppointments));
  } catch (e) {
    check('Dashboard loads', false, e.response?.data?.error || e.message);
  }

  console.log('\n=== 5. Create a walk-in with a PAST date ===');
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().slice(0, 10);
  try {
    const res = await post('/api/admin/walk-in', {
      number: TEST_PHONE,
      lastName: 'Thorough',
      firstName: 'Test',
      middleInitial: 'T',
      service: TEST_SERVICE,
      date: dateStr,
      time: '10:00',
      email: 'thorough@test.com',
      notes: 'THOROUGH_TEST',
    });
    walkInId = res.data?.appointment?.id;
    check('Walk-in created', Boolean(walkInId), `ID ${walkInId}`);
  } catch (e) {
    check('Walk-in created', false, e.response?.data?.error || e.message);
  }

  console.log('\n=== 6. Verify walk-in appears in pendingOutcome (persistence fix) ===');
  try {
    const res = await get('/api/admin/dashboard');
    const found = (res.data.pendingOutcomeAppointments || []).find((a) => a.id === walkInId);
    check('Past walk-in appears in pendingOutcome', Boolean(found), found ? `status=${found.status}` : 'not found');
  } catch (e) {
    check('Past walk-in appears in pendingOutcome', false, e.response?.data?.error || e.message);
  }

  console.log('\n=== 7. Status update flow: mark walk-in as completed ===');
  try {
    const res = await patch(`/api/admin/appointments/${walkInId}/status`, { status: 'completed' });
    check('Mark completed succeeds', res.data?.appointment?.status === 'completed');
  } catch (e) {
    check('Mark completed succeeds', false, e.response?.data?.error || e.message);
  }

  // Create a second walk-in to test notCompleted flow
  console.log('\n=== 8. Create walk-in #2 and mark notCompleted ===');
  let walkInId2 = null;
  try {
    const res = await post('/api/admin/walk-in', {
      number: TEST_PHONE,
      lastName: 'Thorough2',
      firstName: 'Test',
      middleInitial: 'T',
      service: TEST_SERVICE,
      date: dateStr,
      time: '11:00',
    });
    walkInId2 = res.data?.appointment?.id;
    check('Walk-in #2 created', Boolean(walkInId2), `ID ${walkInId2}`);
  } catch (e) {
    check('Walk-in #2 created', false, e.response?.data?.error || e.message);
  }

  if (walkInId2) {
    try {
      const res = await patch(`/api/admin/appointments/${walkInId2}/status`, { status: 'notCompleted' });
      check('Mark notCompleted succeeds', res.data?.appointment?.status === 'notCompleted');
    } catch (e) {
      check('Mark notCompleted succeeds', false, e.response?.data?.error || e.message);
    }
  }

  console.log('\n=== 9. Blocked dates CRUD ===');
  let blockedDateId = null;
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  const futureDateStr = futureDate.toISOString().slice(0, 10);
  try {
    const res = await post('/api/admin/block-dates', { date: futureDateStr, reason: 'THOROUGH_TEST' });
    blockedDateId = res.data?.id;
    check('Block date created', Boolean(blockedDateId));
  } catch (e) {
    check('Block date created', false, e.response?.data?.error || e.message);
  }

  try {
    const res = await get('/api/admin/blocked-dates');
    const found = (res.data || []).some((d) => d.id === blockedDateId);
    check('Blocked date listed', Boolean(blockedDateId && found));
  } catch (e) {
    check('Blocked date listed', false, e.response?.data?.error || e.message);
  }

  if (blockedDateId) {
    try {
      await del(`/api/admin/block-dates/${blockedDateId}`);
      check('Block date deleted', true);
    } catch (e) {
      check('Block date deleted', false, e.response?.data?.error || e.message);
    }
  }

  console.log('\n=== 10. Clients endpoint ===');
  try {
    const res = await get('/api/admin/clients');
    check('Clients returns array', Array.isArray(res.data));
    const found = res.data.some((c) => String(c.number || '').includes(String(TEST_PHONE).slice(-10)));
    check('Test client appears in clients list', found);
  } catch (e) {
    check('Clients endpoint', false, e.response?.data?.error || e.message);
  }

  console.log('\n=== 11. History endpoint (filters) ===');
  try {
    const res = await get(`/api/admin/history?status=completed&from=${dateStr}&to=${dateStr}`);
    check('History with status filter returns array', Array.isArray(res.data?.appointments));
    const found = (res.data?.appointments || []).some((a) => a.id === walkInId);
    check('Completed walk-in found in history', found);
  } catch (e) {
    check('History endpoint', false, e.response?.data?.error || e.message);
  }

  console.log('\n=== 12. History search mode ===');
  try {
    const res = await get('/api/admin/history?search=Thorough');
    check('History search returns array', Array.isArray(res.data?.appointments));
  } catch (e) {
    check('History search', false, e.response?.data?.error || e.message);
  }

  console.log('\n=== 13. Inbox (contact messages) ===');
  try {
    const res = await get('/api/contact/messages');
    check('Inbox returns messages array', Array.isArray(res.data?.messages));
  } catch (e) {
    // Inbox may be under a different route prefix; check admin or contact route
    check('Inbox returns messages array', false, e.response?.data?.error || e.message);
  }

  console.log('\n=== 14. Analytics endpoint ===');
  try {
    const res = await get('/api/admin/analytics?type=monthly');
    const data = res.data;
    check('Analytics returns descriptive', data && typeof data.descriptive === 'object' && Array.isArray(data.descriptive.pie));
    check('Analytics returns walkInVsOnline', data && typeof data.walkInVsOnline === 'object');
  } catch (e) {
    check('Analytics endpoint', false, e.response?.data?.error || e.message);
  }

  console.log('\n=== 15. Online no-show auto-mark (re-verify) ===');
  // Create an online booking via OTP flow, approve it, then confirm it auto-marks notCompleted
  try {
    const otpReq = await axios.post(`${BASE}/api/bookings/request-otp`, {
      number: TEST_PHONE,
      lastName: 'NoShow',
      firstName: 'Auto',
      service: TEST_SERVICE,
      date: dateStr,
      time: '14:00',
      email: '',
    });
    const devOtp = otpReq.data?.devOtp;
    check('OTP request returns devOtp', Boolean(devOtp));
    if (devOtp) {
      const verifyRes = await axios.post(`${BASE}/api/bookings/verify-otp`, {
        number: TEST_PHONE,
        otp: devOtp,
      });
      const onlineId = verifyRes.data?.appointmentId;
      check('Online booking created', Boolean(onlineId), `ID ${onlineId}`);
      if (onlineId) {
        // Approve it
        await patch(`/api/admin/appointments/${onlineId}/status`, { status: 'accepted' });
        // Trigger dashboard (runs auto-mark)
        await get('/api/admin/dashboard');
        // Check the appointment is now notCompleted
        const hist = await get(`/api/admin/history?search=NoShow`);
        const found = (hist.data?.appointments || []).find((a) => a.id === onlineId);
        check('Online no-show auto-marked notCompleted', found?.status === 'notCompleted', found ? `status=${found.status}` : 'not found');
      }
    }
  } catch (e) {
    check('Online no-show auto-mark flow', false, e.response?.data?.error || e.message);
  }

  console.log('\n=== 16. Logout ===');
  try {
    const res = await post('/api/admin/logout', {});
    check('Logout succeeds', res.status === 200);
  } catch (e) {
    check('Logout succeeds', false, e.response?.data?.error || e.message);
  }

  console.log('\n========================================');
  console.log(`RESULTS: ${PASS} passed, ${FAIL} failed`);
  console.log('========================================');
}

run().catch((e) => {
  console.error('Test script error:', e.message);
  process.exit(1);
});
