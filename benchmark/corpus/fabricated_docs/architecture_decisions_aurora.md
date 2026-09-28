# Architecture Decision Records (ADR): Project Aurora

## ADR-001: Selection of Redis Streams for Ingestion Buffer
- **Status:** Approved
- **Deciders:** Leonard Thorne, Devon Reed
- **Context:** We evaluated Apache Kafka, RabbitMQ, and Redis Streams for the initial telemetry ingestion buffer.
- **Decision:** We chose **Redis Streams** because the team already maintains Redis 7 clusters, memory overhead is under 4GB for 24-hour retention, and Redis consumer groups provide millisecond latency without Kafka JVM operational complexity.
- **Consequences:** Ingestion workers must commit stream offsets using `XACK` immediately after writing batches to the database.

## ADR-002: Vector Database Layer — PostgreSQL pgvector vs Pinecone
- **Status:** Approved
- **Deciders:** Leonard Thorne, Patricia Moore
- **Context:** Knowledge search and log similarity require vector indexing.
- **Decision:** Adopt **PostgreSQL pgvector extension** running inside the primary PostgreSQL cluster rather than Pinecone cloud service.
- **Rationale:** Keeps all operational telemetry and embeddings in the same transactional boundary, prevents external cloud data egress fees, and guarantees ACID transactions.

## ADR-003: Anomaly Detection Algorithm — Rolling Z-Score with Welford's Method
- **Status:** Approved
- **Deciders:** Devon Reed, Leonard Thorne
- **Context:** Memory-efficient computation of mean and variance over streaming telemetry is required.
- **Decision:** Implement **Welford's single-pass algorithm** for running standard deviation and Z-score calculation with a 15-minute sliding window. Outliers with |Z| > 3.2 trigger critical severity notifications.
