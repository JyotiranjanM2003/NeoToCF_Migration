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