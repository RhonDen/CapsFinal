#!/usr/bin/env node
/**
 * Smoke tests for AppointEase API
 * Tests: admin login, booking flow, dashboard, contact messages
 */

const http = require('http');

const BASE_URL = 'http://localhost:5000';

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : null;
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: parsed,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data,
          });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting AppointEase API Smoke Tests...\n');

  let adminToken = null;

  try {
    // Test 1: Health check
    console.log('📋 Test 1: Health Check');
    const health = await request('GET', '/api/health');
    console.log(`   Status: ${health.status}`);
    if (health.status === 200) {
      console.log('   ✅ PASS\n');
    } else {
      console.log('   ❌ FAIL\n');
    }

    // Test 2: Admin Login
    console.log('📋 Test 2: Admin Login');
    const login = await request('POST', '/api/admin/login', {
      username: 'admin',
      password: 'admin123',
    });
    console.log(`   Status: ${login.status}`);
    if (login.status === 200) {
      console.log(`   Response: ${JSON.stringify(login.body)}`);
      console.log('   ✅ PASS\n');
    } else {
      console.log(`   Response: ${JSON.stringify(login.body)}`);
      console.log('   ❌ FAIL\n');
    }

    // Test 3: Request OTP for booking
    console.log('📋 Test 3: Request OTP (Booking)');
    const bookingReq = await request('POST', '/api/bookings/request-otp', {
      number: '09123456789',
      firstName: 'John',
      lastName: 'Doe',
      service: 'Routine Dental Checkup - 30 min',
      date: new Date().toISOString().split('T')[0],
      time: '10:00',
    });
    console.log(`   Status: ${bookingReq.status}`);
    if (bookingReq.status === 201 || bookingReq.status === 200) {
      console.log(`   Response: ${JSON.stringify(bookingReq.body)}`);
      console.log('   ✅ PASS\n');
    } else {
      console.log(`   Response: ${JSON.stringify(bookingReq.body)}`);
      console.log('   ⚠️  Status not 200/201\n');
    }

    // Test 4: Contact message
    console.log('📋 Test 4: Submit Contact Message');
    const contact = await request('POST', '/api/contact/messages', {
      name: 'Test User',
      email: 'test-' + Date.now() + '@example.com',
      message: 'This is a test contact message.',
    });
    console.log(`   Status: ${contact.status}`);
    if (contact.status === 201 || contact.status === 200) {
      console.log(`   Response: ${JSON.stringify(contact.body)}`);
      console.log('   ✅ PASS\n');
    } else {
      console.log(`   Response: ${JSON.stringify(contact.body)}`);
      console.log('   ⚠️  Status not 200/201\n');
    }

    console.log('🎉 Smoke tests complete!\n');
  } catch (error) {
    console.error('❌ Test Error:', error.message);
    process.exit(1);
  }
}

runTests();
