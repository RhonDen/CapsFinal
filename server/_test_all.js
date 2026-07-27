const http = require('http');
const { Sequelize } = require('sequelize');
const path = require('path');

const BASE = 'http://localhost:5000';
let adminToken = '';
let walkInId = null;
let testAppointmentId = null;
let testPhone = '+639997045304'; // Known test number with records

function request(method, urlPath, body = null, token = '') {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    if (token) options.headers['Cookie'] = `admin_token=${token}`;
    if (body) options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body));

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  let passed = 0;
  let failed = 0;
  const results = [];

  function assert(name, condition, detail = '') {
    if (condition) {
      passed++;
      results.push(`  ✅ ${name}`);
    } else {
      failed++;
      results.push(`  ❌ ${name} — ${detail}`);
    }
  }

  // ── 1. Login to get admin token ──
  console.log('\n=== 1. Admin Login ===');
  try {
    const loginRes = await request('POST', '/api/admin/login', {
      username: 'admin',
      password: 'admin123',
    });
    assert('Login returns 200', loginRes.status === 200, `Got ${loginRes.status}`);
    if (loginRes.status === 200 && loginRes.body.token) {
      adminToken = loginRes.body.token;
      assert('Token received', adminToken.length > 0);
    }
  } catch (e) {
    assert('Login request', false, e.message);
  }

  if (!adminToken) {
    console.log('  ⚠️  Could not get admin token. Trying to login with default credentials...');
    try {
      const loginRes = await request('POST', '/api/admin/login', {
        username: 'admin',
        password: 'admin',
      });
      if (loginRes.status === 200 && loginRes.body.token) {
        adminToken = loginRes.body.token;
        assert('Token received (admin/admin)', adminToken.length > 0);
      }
    } catch (e) {
      assert('Login retry', false, e.message);
    }
  }

  // ── 2. Check auth ──
  console.log('\n=== 2. Auth Check ===');
  if (adminToken) {
    const authRes = await request('GET', '/api/admin/check-auth', null, adminToken);
    assert('Auth check returns 200', authRes.status === 200, `Got ${authRes.status}`);
    assert('Auth response has authenticated', authRes.body?.authenticated === true);
  } else {
    console.log('  ⚠️  Skipping auth-dependent tests (no token)');
  }

  // ── 3. Dashboard ──
  console.log('\n=== 3. Dashboard ===');
  if (adminToken) {
    const dashRes = await request('GET', '/api/admin/dashboard', null, adminToken);
    assert('Dashboard returns 200', dashRes.status === 200, `Got ${dashRes.status}`);
    assert('Dashboard has stats', dashRes.body?.stats !== undefined);
    assert('Dashboard has pendingAppointments', Array.isArray(dashRes.body?.pendingAppointments));
    assert('Dashboard has todayAppointments', Array.isArray(dashRes.body?.todayAppointments));
    assert('Dashboard has upcomingAppointments', Array.isArray(dashRes.body?.upcomingAppointments));
    assert('Dashboard has todayDateKey', typeof dashRes.body?.todayDateKey === 'string');
    console.log(`  📊 Stats: ${JSON.stringify(dashRes.body?.stats)}`);
    console.log(`  📅 Today: ${dashRes.body?.todayDateKey}`);
    console.log(`  ⏳ Pending: ${dashRes.body?.pendingAppointments?.length}`);
    console.log(`  📋 Today appointments: ${dashRes.body?.todayAppointments?.length}`);
    console.log(`  🔜 Upcoming: ${dashRes.body?.upcomingAppointments?.length}`);
  }

  // ── 4. Clients endpoint ──
  console.log('\n=== 4. Clients ===');
  if (adminToken) {
    const clientsRes = await request('GET', '/api/admin/clients', null, adminToken);
    assert('Clients returns 200', clientsRes.status === 200, `Got ${clientsRes.status}`);
    assert('Clients is array', Array.isArray(clientsRes.body), `Got ${typeof clientsRes.body}`);
    console.log(`  👥 Total clients: ${clientsRes.body?.length || 0}`);
    if (clientsRes.body?.length > 0) {
      const first = clientsRes.body[0];
      assert('Client has number', typeof first.number === 'string');
      assert('Client has fullName', typeof first.fullName === 'string');
      assert('Client has appointmentCount', typeof first.appointmentCount === 'number');
      console.log(`  First client: ${first.fullName} (${first.number}) - ${first.appointmentCount} visits`);
    }
  }

  // ── 5. Client appointments endpoint ──
  console.log('\n=== 5. Client Appointments ===');
  if (adminToken) {
    const clientApptsRes = await request('GET', `/api/admin/clients/${encodeURIComponent(testPhone)}/appointments`, null, adminToken);
    assert('Client appointments returns 200', clientApptsRes.status === 200, `Got ${clientApptsRes.status}`);
    assert('Client appointments is array', Array.isArray(clientApptsRes.body?.appointments), `Got ${JSON.stringify(clientApptsRes.body).slice(0,200)}`);
    const clientAppts = clientApptsRes.body?.appointments || [];
    console.log(`  📅 Appointments for ${testPhone}: ${clientAppts.length || 0}`);
    if (clientAppts.length > 0) {
      const first = clientAppts[0];
      assert('Appointment has fullName', typeof first.fullName === 'string');
      assert('Appointment has dateKey', typeof first.dateKey === 'string');
      assert('Appointment has status', typeof first.status === 'string');
    }
  }

  // ── 6. History OTP flow ──
  console.log('\n=== 6. History OTP Flow ===');
  try {
    const otpReqRes = await request('POST', '/api/bookings/history/request-otp', {
      number: testPhone,
    });
    assert('History OTP request returns 200', otpReqRes.status === 200, `Got ${otpReqRes.status}`);
    if (otpReqRes.status === 200) {
      assert('OTP response has message', typeof otpReqRes.body?.message === 'string');
      const devOtp = otpReqRes.body?.devOtp;
      if (devOtp) {
        console.log(`  🔐 Dev OTP: ${devOtp}`);
        const verifyRes = await request('POST', '/api/bookings/history/verify-otp', {
          number: testPhone,
          otp: devOtp,
        });
        assert('History OTP verify returns 200', verifyRes.status === 200, `Got ${verifyRes.status}`);
        assert('Verify response has appointments', Array.isArray(verifyRes.body?.appointments));
        console.log(`  📋 Appointments found: ${verifyRes.body?.appointments?.length || 0}`);
        if (verifyRes.body?.appointments?.length > 0) {
          // Store an appointment ID for cancel test
          const pendingOrAccepted = verifyRes.body.appointments.find(
            a => a.status === 'pending' || a.status === 'accepted'
          );
          if (pendingOrAccepted) {
            testAppointmentId = pendingOrAccepted.id;
            console.log(`  🆔 Found cancelable appointment: #${testAppointmentId} (${pendingOrAccepted.status})`);
          }
        }
      } else {
        console.log('  ⚠️  No dev OTP in response (production mode?)');
      }
    } else {
      console.log(`  ❌ OTP request failed: ${JSON.stringify(otpReqRes.body)}`);
    }
  } catch (e) {
    assert('History OTP flow', false, e.message);
  }

  // ── 7. Cancel appointment ──
  console.log('\n=== 7. Cancel Appointment ===');
  if (testAppointmentId) {
    const cancelRes = await request('POST', '/api/bookings/cancel', {
      number: testPhone,
      appointmentId: testAppointmentId,
    });
    assert('Cancel returns 200', cancelRes.status === 200, `Got ${cancelRes.status}`);
    assert('Cancel has success message', cancelRes.body?.message?.includes('cancelled'));
    console.log(`  ✅ Cancelled appointment #${testAppointmentId}`);
  } else {
    console.log('  ⚠️  No cancelable appointment found to test cancellation');
    // Test with a non-existent ID to verify error handling
    const cancelRes = await request('POST', '/api/bookings/cancel', {
      number: testPhone,
      appointmentId: 999999,
    });
    assert('Cancel non-existent returns 404', cancelRes.status === 404, `Got ${cancelRes.status}`);
    console.log('  ✅ Cancel error handling works (404 for non-existent)');
  }

  // ── 8. Walk-in creation ──
  console.log('\n=== 8. Walk-in Creation ===');
  if (adminToken) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().slice(0, 10);
    const timeStr = '10:00';

    const walkinRes = await request('POST', '/api/admin/walk-in', {
      firstName: 'Test',
      lastName: 'Walkin',
      number: '09997045304',
      service: 'Teeth Cleaning (30 min)',
      date: dateStr,
      time: timeStr,
    }, adminToken);

    assert('Walk-in returns 201', walkinRes.status === 201, `Got ${walkinRes.status}`);
    if (walkinRes.status === 201) {
      const appt = walkinRes.body?.appointment || walkinRes.body;
      walkInId = appt?.id;
      assert('Walk-in has id', walkInId !== undefined);
      assert('Walk-in status is accepted', appt?.status === 'accepted', `Got ${appt?.status}`);
      assert('Walk-in has scheduledStart', appt?.scheduledStart !== null && appt?.scheduledStart !== undefined);
      assert('Walk-in has dateKey', appt?.dateKey !== null && appt?.dateKey !== undefined);
      console.log(`  ✅ Walk-in created: #${walkInId} (${appt?.status})`);
      console.log(`  📅 Date: ${appt?.dateKey}, Time: ${appt?.time}`);
    } else {
      console.log(`  ❌ Walk-in failed: ${JSON.stringify(walkinRes.body)}`);
    }
  }

  // ── 9. Walk-in edge cases ──
  console.log('\n=== 9. Walk-in Edge Cases ===');
  if (adminToken) {
    // Missing fields
    const missingRes = await request('POST', '/api/admin/walk-in', {
      firstName: 'Incomplete',
    }, adminToken);
    assert('Walk-in missing fields returns 400', missingRes.status === 400, `Got ${missingRes.status}`);

    // Past date - walk-in allows past dates (for historical records), so expect 201
    const pastRes = await request('POST', '/api/admin/walk-in', {
      firstName: 'Past',
      lastName: 'Patient',
      number: '09997045304',
      service: 'Teeth Cleaning - 45 min',
      date: '2020-01-01',
      time: '10:00',
    }, adminToken);
    // Walk-in allows past dates for historical records
    assert('Walk-in past date creates record', pastRes.status === 201, `Got ${pastRes.status}`);
  }

  // ── 10. Verify walk-in appears in dashboard ──
  console.log('\n=== 10. Dashboard After Walk-in ===');
  if (adminToken && walkInId) {
    const dashRes = await request('GET', '/api/admin/dashboard', null, adminToken);
    assert('Dashboard still returns 200', dashRes.status === 200, `Got ${dashRes.status}`);
    
    // Check if walk-in appears in upcoming or today
    const allAppointments = [
      ...(dashRes.body?.upcomingAppointments || []),
      ...(dashRes.body?.todayAppointments || []),
    ];
    const found = allAppointments.find(a => a.id == walkInId);
    assert('Walk-in appears in dashboard', found !== undefined, `ID ${walkInId} not found in ${allAppointments.length} appointments`);
    if (found) {
      console.log(`  ✅ Walk-in #${walkInId} found in dashboard (${found.status})`);
    }
  }

  // ── 11. History endpoint (admin) ──
  console.log('\n=== 11. Admin History ===');
  if (adminToken) {
    const historyRes = await request('GET', '/api/admin/history?status=completed', null, adminToken);
    assert('History returns 200', historyRes.status === 200, `Got ${historyRes.status}`);
    assert('History has appointments array', Array.isArray(historyRes.body?.appointments));
    console.log(`  📋 History records: ${historyRes.body?.appointments?.length || 0}`);

    // Search mode
    const searchRes = await request('GET', '/api/admin/history?search=Rhon', null, adminToken);
    assert('History search returns 200', searchRes.status === 200, `Got ${searchRes.status}`);
    assert('History search has results', Array.isArray(searchRes.body?.appointments));
    console.log(`  🔍 Search "Rhon": ${searchRes.body?.appointments?.length || 0} results`);
  }

  // ── 12. Blocked dates ──
  console.log('\n=== 12. Blocked Dates ===');
  if (adminToken) {
    const blockedRes = await request('GET', '/api/admin/blocked-dates', null, adminToken);
    assert('Blocked dates returns 200', blockedRes.status === 200, `Got ${blockedRes.status}`);
    assert('Blocked dates is array', Array.isArray(blockedRes.body));
    console.log(`  🚫 Blocked dates: ${blockedRes.body?.length || 0}`);
  }

  // ── 13. Availability endpoint ──
  console.log('\n=== 13. Availability ===');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().slice(0, 10);
  const availRes = await request('GET', `/api/bookings/availability?date=${dateStr}&service=Teeth%20Cleaning%20-%2045%20min`);
  assert('Availability returns 200', availRes.status === 200, `Got ${availRes.status}`);
  assert('Availability has availableSlots', Array.isArray(availRes.body?.availableSlots));
  assert('Availability has isDateBlocked', typeof availRes.body?.isDateBlocked === 'boolean');
  console.log(`  🕐 Available slots for ${dateStr}: ${availRes.body?.availableSlots?.length || 0}`);

  // ── Summary ──
  console.log('\n' + '='.repeat(50));
  console.log(`📊 TEST RESULTS: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(50));
  results.forEach(r => console.log(r));

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((e) => {
  console.error('Test suite error:', e);
  process.exit(1);
});
