async function runLoadTest(clientsCount: number, durationSeconds: number) {
    console.log(`Starting load test with ${clientsCount} clients for ${durationSeconds} seconds...`)
    const targetUrl = 'http://localhost:3000/api/auction?view=live'
    
    let totalRequests = 0
    let totalNotModified = 0
    let totalErrors = 0
    
    const startTime = Date.now()
    
    // Simulate a single client
    async function simulateClient(clientId: number) {
        let etag: string | null = null
        while (Date.now() - startTime < durationSeconds * 1000) {
            try {
                const headers: Record<string, string> = {}
                if (etag) {
                    headers['If-None-Match'] = etag
                }
                
                // Assuming tests are run against a local dev environment unauthenticated or with bypasses,
                // or you'd need to mock the authentication cookie here.
                const res = await fetch(targetUrl, { headers })
                
                totalRequests++
                
                if (res.status === 304) {
                    totalNotModified++
                } else if (res.ok) {
                    const newEtag = res.headers.get('ETag')
                    if (newEtag) etag = newEtag
                } else {
                    totalErrors++
                }
            } catch (err) {
                totalErrors++
            }
            
            // Wait 3 seconds before polling again
            await new Promise(resolve => setTimeout(resolve, 3000))
        }
    }
    
    const clients = Array.from({ length: clientsCount }).map((_, i) => simulateClient(i))
    await Promise.all(clients)
    
    console.log('\n--- Load Test Results ---')
    console.log(`Total Requests: ${totalRequests}`)
    console.log(`Not Modified (304): ${totalNotModified}`)
    console.log(`Errors: ${totalErrors}`)
    console.log(`Average Requests/sec: ${(totalRequests / durationSeconds).toFixed(2)}`)
    console.log('-------------------------\n')
}

// Run the script with 100 clients for 15 seconds
runLoadTest(100, 15).catch(console.error)
