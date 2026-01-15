# Load Testing with k6

This directory contains k6 load testing scripts for the Loyal Supply Chain application.

## Prerequisites

Install k6:
```bash
# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D9
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Windows
# Download from https://k6.io/docs/getting-started/installation/
```

Verify installation:
```bash
k6 version
```

## Test Scripts

### Standard Load Tests

#### auth-load.js
Tests authentication endpoint under load:
- Ramp up to 200 concurrent users
- Tests login endpoint performance
- Validates token generation
- Duration: ~16 minutes

#### shipments-load.js
Tests shipments API endpoints:
- List shipments
- Search shipments
- Tests with authentication
- Duration: ~9 minutes

#### contracts-load.js
Tests contracts API endpoints:
- List contracts
- Filter contracts
- Tests with authentication
- Duration: ~9 minutes

#### documents-load.js
Tests document management endpoints:
- List documents
- Search documents
- Tests with authentication
- Duration: ~9 minutes

#### finance-load.js
Tests finance API endpoints:
- List transactions
- Get finance summary
- Tests with authentication
- Duration: ~9 minutes

#### mixed-load.js
Simulates realistic user behavior:
- Mix of different API endpoints (shipments, contracts, notifications, finance)
- Random action selection
- Realistic sleep times
- Duration: ~23 minutes

### Advanced Load Tests

#### stress-test.js
Tests system limits by gradually increasing load:
- Gradually increases from 50 to 400 concurrent users
- Identifies breaking points
- More lenient thresholds (allows up to 5% errors)
- Duration: ~10 minutes

#### spike-test.js
Tests system recovery from sudden load spikes:
- Simulates sudden traffic increase (e.g., marketing campaign)
- Tests recovery after spike
- More lenient thresholds during spike (allows up to 10% errors)
- Duration: ~5 minutes

## Running Tests

### Using npm Scripts (Recommended)

```bash
# Run individual tests
npm run load:auth
npm run load:shipments
npm run load:contracts
npm run load:documents
npm run load:finance
npm run load:mixed
npm run load:stress
npm run load:spike

# Run all standard load tests
npm run load:all
```

### Direct k6 Commands

```bash
# Basic run
k6 run tests/load/auth-load.js

# With environment variables
BASE_URL=http://localhost:3000 k6 run tests/load/shipments-load.js

# With custom credentials
BASE_URL=http://localhost:3000 \
TEST_USERNAME=admin \
TEST_PASSWORD=Admin123! \
k6 run tests/load/mixed-load.js
```

### Environment Variables

All scripts support the following environment variables:

- `BASE_URL`: API base URL (default: `http://localhost:3000`)
- `TEST_USERNAME`: Username for authentication (default: `admin`)
- `TEST_PASSWORD`: Password for authentication (default: `Admin123!`)

Example:
```bash
BASE_URL=http://192.168.1.100:3000 \
TEST_USERNAME=testuser \
TEST_PASSWORD=TestPass123! \
k6 run tests/load/auth-load.js
```

### Generate Reports

#### JSON Report
```bash
k6 run --out json=results.json tests/load/auth-load.js
```

#### HTML Report (using k6-reporter)
```bash
# Install k6-reporter (one-time)
npm install -g k6-reporter

# Generate report
k6 run --out json=results.json tests/load/auth-load.js
k6-reporter results.json -o report.html
```

#### Cloud Results (k6 Cloud)
```bash
# Requires k6 Cloud account
k6 cloud tests/load/auth-load.js
```

## Performance Baselines

Target metrics for standard load tests:
- **Response time**: < 500ms (p95) for simple endpoints
- **Response time**: < 1000ms (p95) for complex queries
- **Error rate**: < 1%
- **Throughput**: > 100 req/s

For stress and spike tests, thresholds are more lenient:
- **Stress test**: Allows up to 5% errors, < 2000ms (p95)
- **Spike test**: Allows up to 10% errors during spike, < 3000ms (p95)

## Understanding Results

### Key Metrics

- **http_req_duration**: Time taken for HTTP requests
  - `p(95)`: 95th percentile (95% of requests faster than this)
  - `avg`: Average response time
  - `min/max`: Minimum and maximum response times

- **http_req_failed**: Percentage of failed requests
  - Should be < 1% for normal operations

- **http_req_receiving**: Time to receive response data
- **http_req_waiting**: Time waiting for response (TTFB)

### Interpreting Results

**Good Performance:**
- p95 response time < 1000ms
- Error rate < 1%
- Consistent performance across stages

**Performance Issues:**
- p95 response time > 2000ms
- Error rate > 5%
- Degrading performance as load increases
- High wait times (indicates server bottleneck)

**System Limits:**
- Stress test shows where system breaks
- Spike test shows recovery capability
- Monitor database connection pool usage

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Load Tests

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:

jobs:
  load-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install k6
        run: |
          sudo gpg -k
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D9
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6
      
      - name: Start backend
        run: |
          cd app
          npm install
          npm run build
          npm start &
          sleep 10
      
      - name: Run load tests
        env:
          BASE_URL: http://localhost:3000
          TEST_USERNAME: admin
          TEST_PASSWORD: Admin123!
        run: |
          npm run load:auth
          npm run load:shipments
```

### Pre-deployment Checklist

Before deploying to production, run:

1. **Standard Load Tests**: Verify normal operation
   ```bash
   npm run load:all
   ```

2. **Stress Test**: Identify breaking points
   ```bash
   npm run load:stress
   ```

3. **Spike Test**: Verify recovery capability
   ```bash
   npm run load:spike
   ```

## Troubleshooting

### Common Issues

**"Connection refused"**
- Ensure backend is running on the specified BASE_URL
- Check firewall settings
- Verify port is accessible

**"401 Unauthorized"**
- Verify TEST_USERNAME and TEST_PASSWORD are correct
- Check JWT_SECRET is set in backend
- Ensure user exists in database

**High error rates**
- Check backend logs for errors
- Monitor database connection pool
- Verify sufficient server resources
- Check for rate limiting

**Slow response times**
- Check database query performance
- Monitor server CPU/memory usage
- Verify network latency
- Check for N+1 query problems

## Best Practices

1. **Run tests against staging environment** before production
2. **Monitor during tests** - Watch server metrics, database connections
3. **Start small** - Begin with lower user counts and gradually increase
4. **Test during off-peak hours** to avoid impacting real users
5. **Document baselines** - Record performance metrics for comparison
6. **Automate** - Include load tests in CI/CD pipeline
7. **Regular testing** - Run load tests after major changes

## Configuration

Shared configuration is in `k6.config.js`:
- Common thresholds
- Base URL helper
- Authentication credentials helper

All test scripts import and use this shared configuration for consistency.

## Additional Resources

- [k6 Documentation](https://k6.io/docs/)
- [k6 JavaScript API](https://k6.io/docs/javascript-api/)
- [k6 Metrics](https://k6.io/docs/using-k6/metrics/)
- [k6 Cloud](https://k6.io/cloud/)
