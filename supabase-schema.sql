CREATE TABLE IF NOT EXISTS "__EFMigrationsHistory" (
    "MigrationId" character varying(150) NOT NULL,
    "ProductVersion" character varying(32) NOT NULL,
    CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY ("MigrationId")
);

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117143847_InitialCreate') THEN
    CREATE TABLE "AuditLogs" (
        "Id" uuid NOT NULL,
        "UserId" uuid,
        "UserName" text,
        "Action" text NOT NULL,
        "Entity" text NOT NULL,
        "EntityId" text,
        "Details" text,
        "IpAddress" text,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "TenantId" uuid NOT NULL,
        CONSTRAINT "PK_AuditLogs" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117143847_InitialCreate') THEN
    CREATE TABLE "Categories" (
        "Id" uuid NOT NULL,
        "Name" text NOT NULL,
        "Description" text,
        "Color" text NOT NULL,
        "Icon" text,
        "IsActive" boolean NOT NULL,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "TenantId" uuid NOT NULL,
        CONSTRAINT "PK_Categories" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117143847_InitialCreate') THEN
    CREATE TABLE "Customers" (
        "Id" uuid NOT NULL,
        "Name" text NOT NULL,
        "DocumentNumber" text,
        "Email" text,
        "Phone" text,
        "Address" text,
        "Notes" text,
        "Tags" text,
        "LoyaltyPoints" integer NOT NULL,
        "IsActive" boolean NOT NULL,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "TenantId" uuid NOT NULL,
        CONSTRAINT "PK_Customers" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117143847_InitialCreate') THEN
    CREATE TABLE "Expenses" (
        "Id" uuid NOT NULL,
        "Category" text NOT NULL,
        "Description" text NOT NULL,
        "Amount" numeric(18,2) NOT NULL,
        "Date" timestamp with time zone NOT NULL,
        "PaymentMethod" integer NOT NULL,
        "SupplierId" uuid,
        "BranchId" uuid,
        "UserId" uuid,
        "Notes" text,
        "ReceiptUrl" text,
        "IsRecurring" boolean NOT NULL,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "TenantId" uuid NOT NULL,
        CONSTRAINT "PK_Expenses" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117143847_InitialCreate') THEN
    CREATE TABLE "InventoryMovements" (
        "Id" uuid NOT NULL,
        "ProductId" uuid NOT NULL,
        "VariantId" uuid,
        "BranchId" uuid,
        "Type" integer NOT NULL,
        "Quantity" integer NOT NULL,
        "PreviousStock" integer NOT NULL,
        "NewStock" integer NOT NULL,
        "Reference" text,
        "Notes" text,
        "UserId" uuid,
        "ProductName" text,
        "UserName" text,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "TenantId" uuid NOT NULL,
        CONSTRAINT "PK_InventoryMovements" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117143847_InitialCreate') THEN
    CREATE TABLE "Sales" (
        "Id" uuid NOT NULL,
        "Number" text NOT NULL,
        "BranchId" uuid,
        "CustomerId" uuid,
        "CustomerName" text,
        "UserId" uuid,
        "UserName" text,
        "Subtotal" numeric(18,2) NOT NULL,
        "Discount" numeric(18,2) NOT NULL,
        "Tax" numeric(18,2) NOT NULL,
        "Total" numeric(18,2) NOT NULL,
        "PaidAmount" numeric(18,2) NOT NULL,
        "Change" numeric(18,2) NOT NULL,
        "PaymentMethod" integer NOT NULL,
        "Status" integer NOT NULL,
        "Notes" text,
        "Channel" text,
        "CancelledAt" timestamp with time zone,
        "CancelReason" text,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "TenantId" uuid NOT NULL,
        CONSTRAINT "PK_Sales" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117143847_InitialCreate') THEN
    CREATE TABLE "Suppliers" (
        "Id" uuid NOT NULL,
        "Name" text NOT NULL,
        "ContactName" text,
        "DocumentNumber" text,
        "Email" text,
        "Phone" text,
        "Address" text,
        "Notes" text,
        "IsActive" boolean NOT NULL,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "TenantId" uuid NOT NULL,
        CONSTRAINT "PK_Suppliers" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117143847_InitialCreate') THEN
    CREATE TABLE "Tenants" (
        "Id" uuid NOT NULL,
        "Name" character varying(160) NOT NULL,
        "Slug" text NOT NULL,
        "Email" text NOT NULL,
        "Phone" text,
        "Address" text,
        "City" text,
        "Country" text,
        "Currency" text NOT NULL,
        "CurrencySymbol" text NOT NULL,
        "Locale" text NOT NULL,
        "TimeZone" text NOT NULL,
        "BusinessType" integer NOT NULL,
        "LogoUrl" text,
        "Description" text,
        "TaxName" text,
        "TaxRate" numeric(5,2) NOT NULL,
        "TaxIncluded" boolean NOT NULL,
        "BusinessHours" text,
        "PaymentMethods" text,
        "Website" text,
        "Instagram" text,
        "Plan" integer NOT NULL,
        "IsActive" boolean NOT NULL,
        "TrialEndsAt" timestamp with time zone,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        CONSTRAINT "PK_Tenants" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117143847_InitialCreate') THEN
    CREATE TABLE "WhatsAppAccounts" (
        "Id" uuid NOT NULL,
        "WabaId" text,
        "PhoneNumberId" text,
        "DisplayPhoneNumber" text,
        "AccessToken" text,
        "VerifyToken" text NOT NULL,
        "AppSecret" text,
        "IsEnabled" boolean NOT NULL,
        "AiEnabled" boolean NOT NULL,
        "AiModel" text,
        "WelcomeMessage" text NOT NULL,
        "FallbackMessage" text NOT NULL,
        "HandoffMessage" text NOT NULL,
        "BusinessHoursText" text,
        "LocationText" text,
        "PaymentMethodsText" text,
        "ServicesText" text,
        "SystemPrompt" text,
        "AutoReplyEnabled" boolean NOT NULL,
        "ProductLookupEnabled" boolean NOT NULL,
        "ConnectedAt" timestamp with time zone,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "TenantId" uuid NOT NULL,
        CONSTRAINT "PK_WhatsAppAccounts" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117143847_InitialCreate') THEN
    CREATE TABLE "WhatsAppContacts" (
        "Id" uuid NOT NULL,
        "WaId" text NOT NULL,
        "Name" text,
        "Phone" text,
        "CustomerId" uuid,
        "LastMessageAt" timestamp with time zone NOT NULL,
        "UnreadCount" integer NOT NULL,
        "IsBlocked" boolean NOT NULL,
        "AvatarUrl" text,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "TenantId" uuid NOT NULL,
        CONSTRAINT "PK_WhatsAppContacts" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117143847_InitialCreate') THEN
    CREATE TABLE "WhatsAppFaqs" (
        "Id" uuid NOT NULL,
        "Question" text NOT NULL,
        "Answer" text NOT NULL,
        "Keywords" text,
        "Priority" integer NOT NULL,
        "IsActive" boolean NOT NULL,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "TenantId" uuid NOT NULL,
        CONSTRAINT "PK_WhatsAppFaqs" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117143847_InitialCreate') THEN
    CREATE TABLE "Products" (
        "Id" uuid NOT NULL,
        "Name" text NOT NULL,
        "Sku" text NOT NULL,
        "Barcode" text,
        "Description" text,
        "CategoryId" uuid,
        "Type" integer NOT NULL,
        "Price" numeric(18,2) NOT NULL,
        "Cost" numeric(18,2) NOT NULL,
        "CompareAtPrice" numeric(18,2),
        "Unit" text NOT NULL,
        "ImageUrl" text,
        "Brand" text,
        "IsActive" boolean NOT NULL,
        "TrackStock" boolean NOT NULL,
        "Stock" integer NOT NULL,
        "MinStock" integer NOT NULL,
        "Tags" text,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "TenantId" uuid NOT NULL,
        CONSTRAINT "PK_Products" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_Products_Categories_CategoryId" FOREIGN KEY ("CategoryId") REFERENCES "Categories" ("Id") ON DELETE SET NULL
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117143847_InitialCreate') THEN
    CREATE TABLE "SaleItems" (
        "Id" uuid NOT NULL,
        "SaleId" uuid NOT NULL,
        "ProductId" uuid NOT NULL,
        "VariantId" uuid,
        "ProductName" text NOT NULL,
        "VariantName" text,
        "Sku" text,
        "Quantity" integer NOT NULL,
        "UnitPrice" numeric(18,2) NOT NULL,
        "UnitCost" numeric(18,2) NOT NULL,
        "Discount" numeric(18,2) NOT NULL,
        "Total" numeric(18,2) NOT NULL,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "TenantId" uuid NOT NULL,
        CONSTRAINT "PK_SaleItems" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_SaleItems_Sales_SaleId" FOREIGN KEY ("SaleId") REFERENCES "Sales" ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117143847_InitialCreate') THEN
    CREATE TABLE "Branches" (
        "Id" uuid NOT NULL,
        "Name" text NOT NULL,
        "Code" text NOT NULL,
        "Address" text,
        "City" text,
        "Phone" text,
        "IsMain" boolean NOT NULL,
        "IsActive" boolean NOT NULL,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "TenantId" uuid NOT NULL,
        CONSTRAINT "PK_Branches" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_Branches_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117143847_InitialCreate') THEN
    CREATE TABLE "Conversations" (
        "Id" uuid NOT NULL,
        "ContactId" uuid NOT NULL,
        "AssignedUserId" uuid,
        "AssignedUserName" text,
        "Status" integer NOT NULL,
        "LastMessagePreview" text,
        "LastMessageAt" timestamp with time zone NOT NULL,
        "MessageCount" integer NOT NULL,
        "Tags" text,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "TenantId" uuid NOT NULL,
        CONSTRAINT "PK_Conversations" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_Conversations_WhatsAppContacts_ContactId" FOREIGN KEY ("ContactId") REFERENCES "WhatsAppContacts" ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117143847_InitialCreate') THEN
    CREATE TABLE "ProductVariants" (
        "Id" uuid NOT NULL,
        "ProductId" uuid NOT NULL,
        "Name" text NOT NULL,
        "Sku" text,
        "Price" numeric(18,2),
        "Stock" integer NOT NULL,
        "IsActive" boolean NOT NULL,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "TenantId" uuid NOT NULL,
        CONSTRAINT "PK_ProductVariants" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_ProductVariants_Products_ProductId" FOREIGN KEY ("ProductId") REFERENCES "Products" ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117143847_InitialCreate') THEN
    CREATE TABLE "Users" (
        "Id" uuid NOT NULL,
        "FullName" text NOT NULL,
        "Email" character varying(200) NOT NULL,
        "PasswordHash" text NOT NULL,
        "Phone" text,
        "AvatarUrl" text,
        "Role" integer NOT NULL,
        "BranchId" uuid,
        "Permissions" text NOT NULL,
        "IsActive" boolean NOT NULL,
        "LastLoginAt" timestamp with time zone,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "TenantId" uuid NOT NULL,
        CONSTRAINT "PK_Users" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_Users_Branches_BranchId" FOREIGN KEY ("BranchId") REFERENCES "Branches" ("Id") ON DELETE SET NULL,
        CONSTRAINT "FK_Users_Tenants_TenantId" FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117143847_InitialCreate') THEN
    CREATE TABLE "Messages" (
        "Id" uuid NOT NULL,
        "ConversationId" uuid NOT NULL,
        "Direction" integer NOT NULL,
        "Body" text NOT NULL,
        "Type" text,
        "MediaUrl" text,
        "Status" text,
        "IsAutomated" boolean NOT NULL,
        "Intent" text,
        "SentByUserId" uuid,
        "SentByName" text,
        "ExternalId" text,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "TenantId" uuid NOT NULL,
        CONSTRAINT "PK_Messages" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_Messages_Conversations_ConversationId" FOREIGN KEY ("ConversationId") REFERENCES "Conversations" ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117143847_InitialCreate') THEN
    CREATE UNIQUE INDEX "IX_Branches_TenantId_Code" ON "Branches" ("TenantId", "Code");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117143847_InitialCreate') THEN
    CREATE INDEX "IX_Categories_TenantId_Name" ON "Categories" ("TenantId", "Name");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117143847_InitialCreate') THEN
    CREATE INDEX "IX_Conversations_ContactId" ON "Conversations" ("ContactId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117143847_InitialCreate') THEN
    CREATE INDEX "IX_Conversations_TenantId_LastMessageAt" ON "Conversations" ("TenantId", "LastMessageAt");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117143847_InitialCreate') THEN
    CREATE INDEX "IX_InventoryMovements_TenantId_CreatedAt" ON "InventoryMovements" ("TenantId", "CreatedAt");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117143847_InitialCreate') THEN
    CREATE INDEX "IX_Messages_ConversationId" ON "Messages" ("ConversationId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117143847_InitialCreate') THEN
    CREATE INDEX "IX_Messages_TenantId_CreatedAt" ON "Messages" ("TenantId", "CreatedAt");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117143847_InitialCreate') THEN
    CREATE INDEX "IX_Products_CategoryId" ON "Products" ("CategoryId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117143847_InitialCreate') THEN
    CREATE INDEX "IX_Products_TenantId_Sku" ON "Products" ("TenantId", "Sku");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117143847_InitialCreate') THEN
    CREATE INDEX "IX_ProductVariants_ProductId" ON "ProductVariants" ("ProductId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117143847_InitialCreate') THEN
    CREATE INDEX "IX_SaleItems_SaleId" ON "SaleItems" ("SaleId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117143847_InitialCreate') THEN
    CREATE UNIQUE INDEX "IX_Sales_TenantId_Number" ON "Sales" ("TenantId", "Number");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117143847_InitialCreate') THEN
    CREATE UNIQUE INDEX "IX_Tenants_Slug" ON "Tenants" ("Slug");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117143847_InitialCreate') THEN
    CREATE INDEX "IX_Users_BranchId" ON "Users" ("BranchId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117143847_InitialCreate') THEN
    CREATE UNIQUE INDEX "IX_Users_Email" ON "Users" ("Email");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117143847_InitialCreate') THEN
    CREATE INDEX "IX_Users_TenantId" ON "Users" ("TenantId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117143847_InitialCreate') THEN
    CREATE INDEX "IX_WhatsAppAccounts_TenantId_PhoneNumberId" ON "WhatsAppAccounts" ("TenantId", "PhoneNumberId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117143847_InitialCreate') THEN
    CREATE UNIQUE INDEX "IX_WhatsAppContacts_TenantId_WaId" ON "WhatsAppContacts" ("TenantId", "WaId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261117143847_InitialCreate') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20261117143847_InitialCreate', '10.0.15');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261120181414_OperationsAndBilling') THEN
    CREATE TABLE "CashSessions" (
        "Id" uuid NOT NULL,
        "BranchId" uuid,
        "BranchName" text,
        "UserId" uuid,
        "UserName" text,
        "OpenedAt" timestamp with time zone NOT NULL,
        "ClosedAt" timestamp with time zone,
        "OpeningAmount" numeric(18,2) NOT NULL,
        "SalesAmount" numeric(18,2) NOT NULL,
        "IncomeAmount" numeric(18,2) NOT NULL,
        "ExpenseAmount" numeric(18,2) NOT NULL,
        "ExpectedAmount" numeric(18,2) NOT NULL,
        "CountedAmount" numeric(18,2),
        "Difference" numeric(18,2) NOT NULL,
        "Status" integer NOT NULL,
        "Notes" text,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "TenantId" uuid NOT NULL,
        CONSTRAINT "PK_CashSessions" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261120181414_OperationsAndBilling') THEN
    CREATE TABLE "Orders" (
        "Id" uuid NOT NULL,
        "Number" text NOT NULL,
        "Channel" integer NOT NULL,
        "Status" integer NOT NULL,
        "CustomerId" uuid,
        "CustomerName" text NOT NULL,
        "CustomerPhone" text,
        "BranchId" uuid,
        "Total" numeric(18,2) NOT NULL,
        "DueAt" timestamp with time zone,
        "DeliveredAt" timestamp with time zone,
        "SaleId" uuid,
        "SaleNumber" text,
        "Notes" text,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "TenantId" uuid NOT NULL,
        CONSTRAINT "PK_Orders" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261120181414_OperationsAndBilling') THEN
    CREATE TABLE "Receivables" (
        "Id" uuid NOT NULL,
        "CustomerId" uuid,
        "CustomerName" text NOT NULL,
        "CustomerPhone" text,
        "SaleId" uuid,
        "SaleNumber" text,
        "Concept" text NOT NULL,
        "Total" numeric(18,2) NOT NULL,
        "PaidAmount" numeric(18,2) NOT NULL,
        "IssuedAt" timestamp with time zone NOT NULL,
        "DueDate" timestamp with time zone NOT NULL,
        "PaidAt" timestamp with time zone,
        "Status" integer NOT NULL,
        "Notes" text,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "TenantId" uuid NOT NULL,
        CONSTRAINT "PK_Receivables" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261120181414_OperationsAndBilling') THEN
    CREATE TABLE "Subscriptions" (
        "Id" uuid NOT NULL,
        "Plan" integer NOT NULL,
        "Cycle" integer NOT NULL,
        "Status" integer NOT NULL,
        "CurrentPeriodStart" timestamp with time zone NOT NULL,
        "CurrentPeriodEnd" timestamp with time zone NOT NULL,
        "TrialEndsAt" timestamp with time zone,
        "CancelledAt" timestamp with time zone,
        "LastPaymentAt" timestamp with time zone,
        "BasePrice" numeric(18,2) NOT NULL,
        "AddonsPrice" numeric(18,2) NOT NULL,
        "Discount" numeric(18,2) NOT NULL,
        "Total" numeric(18,2) NOT NULL,
        "Addons" text,
        "PaymentMethod" text,
        "PaymentChannel" text,
        "LastInvoiceNumber" text,
        "CancelAtPeriodEnd" boolean NOT NULL,
        "Notes" text,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "TenantId" uuid NOT NULL,
        CONSTRAINT "PK_Subscriptions" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261120181414_OperationsAndBilling') THEN
    CREATE TABLE "CashMovements" (
        "Id" uuid NOT NULL,
        "CashSessionId" uuid NOT NULL,
        "Type" integer NOT NULL,
        "Concept" text NOT NULL,
        "Amount" numeric(18,2) NOT NULL,
        "PaymentMethod" text,
        "Reference" text,
        "SaleId" uuid,
        "UserId" uuid,
        "UserName" text,
        "Date" timestamp with time zone NOT NULL,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "TenantId" uuid NOT NULL,
        CONSTRAINT "PK_CashMovements" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_CashMovements_CashSessions_CashSessionId" FOREIGN KEY ("CashSessionId") REFERENCES "CashSessions" ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261120181414_OperationsAndBilling') THEN
    CREATE TABLE "OrderItems" (
        "Id" uuid NOT NULL,
        "OrderId" uuid NOT NULL,
        "ProductId" uuid,
        "ProductName" text NOT NULL,
        "Quantity" integer NOT NULL,
        "UnitPrice" numeric(18,2) NOT NULL,
        "Total" numeric(18,2) NOT NULL,
        "Notes" text,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "TenantId" uuid NOT NULL,
        CONSTRAINT "PK_OrderItems" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_OrderItems_Orders_OrderId" FOREIGN KEY ("OrderId") REFERENCES "Orders" ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261120181414_OperationsAndBilling') THEN
    CREATE TABLE "ReceivablePayments" (
        "Id" uuid NOT NULL,
        "ReceivableId" uuid NOT NULL,
        "Amount" numeric(18,2) NOT NULL,
        "Date" timestamp with time zone NOT NULL,
        "Method" text,
        "Reference" text,
        "Notes" text,
        "UserId" uuid,
        "UserName" text,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "TenantId" uuid NOT NULL,
        CONSTRAINT "PK_ReceivablePayments" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_ReceivablePayments_Receivables_ReceivableId" FOREIGN KEY ("ReceivableId") REFERENCES "Receivables" ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261120181414_OperationsAndBilling') THEN
    CREATE TABLE "SubscriptionInvoices" (
        "Id" uuid NOT NULL,
        "Number" text NOT NULL,
        "Plan" text NOT NULL,
        "Cycle" integer NOT NULL,
        "Subtotal" numeric(18,2) NOT NULL,
        "Addons" numeric(18,2) NOT NULL,
        "Discount" numeric(18,2) NOT NULL,
        "Tax" numeric(18,2) NOT NULL,
        "Total" numeric(18,2) NOT NULL,
        "Status" integer NOT NULL,
        "IssuedAt" timestamp with time zone NOT NULL,
        "DueAt" timestamp with time zone NOT NULL,
        "PaidAt" timestamp with time zone,
        "PaymentMethod" text,
        "PaymentChannel" text,
        "Reference" text,
        "CouponCode" text,
        "Description" text,
        "AddonList" text,
        "SubscriptionId" uuid,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "TenantId" uuid NOT NULL,
        CONSTRAINT "PK_SubscriptionInvoices" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_SubscriptionInvoices_Subscriptions_SubscriptionId" FOREIGN KEY ("SubscriptionId") REFERENCES "Subscriptions" ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261120181414_OperationsAndBilling') THEN
    CREATE INDEX "IX_CashMovements_CashSessionId" ON "CashMovements" ("CashSessionId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261120181414_OperationsAndBilling') THEN
    CREATE INDEX "IX_CashMovements_TenantId_Date" ON "CashMovements" ("TenantId", "Date");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261120181414_OperationsAndBilling') THEN
    CREATE INDEX "IX_CashSessions_TenantId_Status" ON "CashSessions" ("TenantId", "Status");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261120181414_OperationsAndBilling') THEN
    CREATE INDEX "IX_OrderItems_OrderId" ON "OrderItems" ("OrderId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261120181414_OperationsAndBilling') THEN
    CREATE UNIQUE INDEX "IX_Orders_TenantId_Number" ON "Orders" ("TenantId", "Number");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261120181414_OperationsAndBilling') THEN
    CREATE INDEX "IX_Orders_TenantId_Status" ON "Orders" ("TenantId", "Status");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261120181414_OperationsAndBilling') THEN
    CREATE INDEX "IX_ReceivablePayments_ReceivableId" ON "ReceivablePayments" ("ReceivableId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261120181414_OperationsAndBilling') THEN
    CREATE INDEX "IX_Receivables_TenantId_DueDate" ON "Receivables" ("TenantId", "DueDate");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261120181414_OperationsAndBilling') THEN
    CREATE INDEX "IX_SubscriptionInvoices_SubscriptionId" ON "SubscriptionInvoices" ("SubscriptionId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261120181414_OperationsAndBilling') THEN
    CREATE UNIQUE INDEX "IX_SubscriptionInvoices_TenantId_Number" ON "SubscriptionInvoices" ("TenantId", "Number");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261120181414_OperationsAndBilling') THEN
    CREATE UNIQUE INDEX "IX_Subscriptions_TenantId" ON "Subscriptions" ("TenantId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261120181414_OperationsAndBilling') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20261120181414_OperationsAndBilling', '10.0.15');
    END IF;
END $EF$;
COMMIT;

