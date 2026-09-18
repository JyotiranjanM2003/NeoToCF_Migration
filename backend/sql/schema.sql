-- ============================================================
-- Neo -> Cloud Foundry Migration App - SAP HANA schema
-- Run this once against your HANA_SCHEMA before starting the app.
-- ============================================================

-- ========== USERS ==========
CREATE TABLE APP_USER (
    UserId          NVARCHAR(36)  PRIMARY KEY,
    Email           NVARCHAR(255) UNIQUE NOT NULL,
    PasswordHash    NVARCHAR(255) NOT NULL,
    FullName        NVARCHAR(150),
    CreatedAt       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    LastLoginAt     TIMESTAMP
);

-- ========== SOURCE TENANT (Neo) ==========
CREATE TABLE SOURCE_TENANT (
    SourceTenantId  NVARCHAR(36)  PRIMARY KEY,
    UserId          NVARCHAR(36)  NOT NULL REFERENCES APP_USER(UserId),
    TenantName      NVARCHAR(150),
    Host            NVARCHAR(255) NOT NULL,
    TokenHost       NVARCHAR(255) NOT NULL,
    OAuthClientId       NVARCHAR(255) NOT NULL,
    OAuthClientSecretEnc NVARCHAR(500) NOT NULL,
    SrcDomain       NVARCHAR(255),
    SrcAccountId    NVARCHAR(100),
    ConnectionStatus NVARCHAR(20)  DEFAULT 'DISCONNECTED',
    LastTestedAt    TIMESTAMP,
    CreatedAt       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- ========== TARGET TENANT (Cloud Foundry) ==========
CREATE TABLE TARGET_TENANT (
    TargetTenantId  NVARCHAR(36)  PRIMARY KEY,
    UserId          NVARCHAR(36)  NOT NULL REFERENCES APP_USER(UserId),
    TenantName      NVARCHAR(150),
    Host            NVARCHAR(255) NOT NULL,
    TokenHost       NVARCHAR(255) NOT NULL,
    OAuthClientId       NVARCHAR(255) NOT NULL,
    OAuthClientSecretEnc NVARCHAR(500) NOT NULL,
    TgtDomain       NVARCHAR(255),
    CfOrgId         NVARCHAR(100),
    SpaceName       NVARCHAR(150),
    ConnectionStatus NVARCHAR(20)  DEFAULT 'DISCONNECTED',
    LastTestedAt    TIMESTAMP,
    CreatedAt       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- ========== MIGRATION ==========
CREATE TABLE MIGRATION (
    MigrationId     NVARCHAR(36)  PRIMARY KEY,
    UserId          NVARCHAR(36)  NOT NULL REFERENCES APP_USER(UserId),
    SourceTenantId  NVARCHAR(36)  NOT NULL REFERENCES SOURCE_TENANT(SourceTenantId),
    TargetTenantId  NVARCHAR(36)  NOT NULL REFERENCES TARGET_TENANT(TargetTenantId),
    PackageName     NVARCHAR(255) NOT NULL,
    ScopeType       NVARCHAR(20)  NOT NULL,
    Status          NVARCHAR(20)  DEFAULT 'PENDING',
    StartedAt       TIMESTAMP,
    CompletedAt     TIMESTAMP
);

-- ========== MIGRATION ARTIFACT ==========
CREATE TABLE MIGRATION_ARTIFACT (
    Id              NVARCHAR(36)  PRIMARY KEY,
    MigrationId     NVARCHAR(36)  NOT NULL REFERENCES MIGRATION(MigrationId),
    ArtifactId      NVARCHAR(255) NOT NULL,
    ArtifactName    NVARCHAR(255) NOT NULL,
    ArtifactType    NVARCHAR(30)  NOT NULL,
    Version         NVARCHAR(20),
    Status          NVARCHAR(20)  DEFAULT 'PENDING',
    ErrorMessage    NVARCHAR(2000)
);

-- ========== MIGRATION CONFIGURATION ==========
CREATE TABLE MIGRATION_CONFIGURATION (
    Id                    NVARCHAR(36) PRIMARY KEY,
    MigrationArtifactId   NVARCHAR(36) NOT NULL REFERENCES MIGRATION_ARTIFACT(Id),
    ParameterName         NVARCHAR(255) NOT NULL,
    ParameterDataType     NVARCHAR(50),
    SourceValue           NVARCHAR(2000),
    TargetValue           NVARCHAR(2000),
    Status                NVARCHAR(20) DEFAULT 'PENDING'
);

-- ========== MIGRATION LOG ==========
CREATE TABLE MIGRATION_LOG (
    Id              NVARCHAR(36)  PRIMARY KEY,
    MigrationId     NVARCHAR(36)  NOT NULL REFERENCES MIGRATION(MigrationId),
    Step            NVARCHAR(50)  NOT NULL,
    Status          NVARCHAR(20)  NOT NULL,
    Message         NVARCHAR(2000),
    Timestamp       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- ========== TRANSFORM RULE (find/replace config transform, e.g. host mapping) ==========
CREATE TABLE TRANSFORM_RULE (
    Id              NVARCHAR(36)  PRIMARY KEY,
    UserId          NVARCHAR(36)  NOT NULL REFERENCES APP_USER(UserId),
    RuleName        NVARCHAR(150),
    FindValue       NVARCHAR(500) NOT NULL,   -- e.g. source host / string to match
    ReplaceValue    NVARCHAR(500) NOT NULL,   -- e.g. target host / replacement string
    ParameterScope  NVARCHAR(255),            -- optional: restrict to a specific parameter name, NULL = all
    IsActive        TINYINT       DEFAULT 1,
    CreatedAt       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE MIGRATION_BATCH (
    BatchId         NVARCHAR(36)  PRIMARY KEY,
    UserId          NVARCHAR(36)  NOT NULL REFERENCES APP_USER(UserId),
    SourceTenantId  NVARCHAR(36)  NOT NULL REFERENCES SOURCE_TENANT(SourceTenantId),
    TargetTenantId  NVARCHAR(36)  NOT NULL REFERENCES TARGET_TENANT(TargetTenantId),
    Status          NVARCHAR(20)  DEFAULT 'RUNNING',
    StartedAt       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    CompletedAt     TIMESTAMP
);

ALTER TABLE MIGRATION ADD (BatchId NVARCHAR(36));
CREATE TABLE USER_TENANT_SELECTION (
    UserId NVARCHAR(36),
    SourceTenantId NVARCHAR(36),
    TargetTenantId NVARCHAR(36),
    UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (UserId),

    FOREIGN KEY (UserId)
        REFERENCES APP_USER (UserId),

    FOREIGN KEY (SourceTenantId)
        REFERENCES SOURCE_TENANT (SourceTenantId),

    FOREIGN KEY (TargetTenantId)
        REFERENCES TARGET_TENANT (TargetTenantId)
);

CREATE TABLE DATASTORE_OPERATION (
    Id                  NVARCHAR(36)   PRIMARY KEY,
    MigrationId         NVARCHAR(36)   NOT NULL REFERENCES MIGRATION(MigrationId),
    MigrationArtifactId NVARCHAR(36)   REFERENCES MIGRATION_ARTIFACT(Id),
    UserId              NVARCHAR(36)   NOT NULL REFERENCES APP_USER(UserId),
    SourceTenantId      NVARCHAR(36)   NOT NULL REFERENCES SOURCE_TENANT(SourceTenantId),
    TargetTenantId      NVARCHAR(36)   NOT NULL REFERENCES TARGET_TENANT(TargetTenantId),
    DataStoreName       NVARCHAR(255)  NOT NULL,
    IntegrationFlow     NVARCHAR(255),
    DataStoreType       NVARCHAR(50),
    EntryId             NVARCHAR(255),
    HelperFlowId        NVARCHAR(255),
    ExpiryPeriodDays    INT,
    AlertPeriodDays     INT,
    EntryCount          INT,
    Status              NVARCHAR(20)   DEFAULT 'PENDING',
    ErrorMessage        NVARCHAR(2000),
    StartedAt           TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
    CompletedAt          TIMESTAMP
);

CREATE INDEX IDX_DSOP_USER_STARTED ON DATASTORE_OPERATION (UserId, StartedAt DESC);

CREATE INDEX IDX_DSOP_NAME_FLOW ON DATASTORE_OPERATION (DataStoreName, IntegrationFlow);

ALTER TABLE MIGRATION ADD (SourceHost NVARCHAR(255));
ALTER TABLE MIGRATION ADD (TargetHost NVARCHAR(255));

ALTER TABLE DATASTORE_OPERATION ADD (SourceHost NVARCHAR(255));
ALTER TABLE DATASTORE_OPERATION ADD (TargetHost NVARCHAR(255));

CREATE INDEX IDX_MIGRATION_TARGETHOST ON MIGRATION (TargetHost);
CREATE INDEX IDX_MIGRATION_SOURCEHOST ON MIGRATION (SourceHost);
CREATE INDEX IDX_DSOP_TARGETHOST ON DATASTORE_OPERATION (TargetHost);

-- Backfill existing rows (run once, against your live schema)
UPDATE MIGRATION m
   SET TargetHost = (SELECT Host FROM TARGET_TENANT t WHERE t.TargetTenantId = m.TargetTenantId),
       SourceHost = (SELECT Host FROM SOURCE_TENANT s WHERE s.SourceTenantId = m.SourceTenantId)
 WHERE m.TargetHost IS NULL;

UPDATE DATASTORE_OPERATION d
   SET TargetHost = (SELECT Host FROM TARGET_TENANT t WHERE t.TargetTenantId = d.TargetTenantId),
       SourceHost = (SELECT Host FROM SOURCE_TENANT s WHERE s.SourceTenantId = d.SourceTenantId)
 WHERE d.TargetHost IS NULL;


 -- ========== PASSWORD RESET TOKEN ==========
-- Stores only a SHA-256 hash of the reset token that was emailed to the
-- user, never the raw token, mirroring how PasswordHash never stores a
-- plaintext password.
CREATE TABLE PASSWORD_RESET_TOKEN (
    Id              NVARCHAR(36)  PRIMARY KEY,
    UserId          NVARCHAR(36)  NOT NULL REFERENCES APP_USER(UserId),
    TokenHash       NVARCHAR(64)  NOT NULL,
    ExpiresAt       TIMESTAMP     NOT NULL,
    Used            TINYINT       DEFAULT 0,
    CreatedAt       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    RequestIp       NVARCHAR(100)
);

CREATE INDEX IDX_PRT_TOKENHASH ON PASSWORD_RESET_TOKEN (TokenHash);
CREATE INDEX IDX_PRT_USER ON PASSWORD_RESET_TOKEN (UserId);