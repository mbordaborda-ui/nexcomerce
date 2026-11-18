using Microsoft.EntityFrameworkCore;
using NexComerce.Domain.Catalog;
using NexComerce.Domain.Common;
using NexComerce.Domain.Contacts;
using NexComerce.Domain.Finance;
using NexComerce.Domain.Inventory;
using NexComerce.Domain.Sales;
using NexComerce.Domain.Tenancy;
using NexComerce.Domain.WhatsApp;
using NexComerce.Infrastructure.Security;

namespace NexComerce.Infrastructure.Persistence;

public static class DbSeeder
{
    public static async Task SeedAsync(AppDbContext db)
    {
        if (await db.Tenants.AnyAsync()) return;

        db.TenantBypass = true;
        var rnd = new Random(7);
        var now = DateTime.UtcNow;
        var tenantId = Guid.NewGuid();

        var tenant = new Tenant
        {
            Id = tenantId,
            Name = "Empire Store",
            Slug = "empire-store",
            Email = "demo@nexcomerce.app",
            Phone = "+57 320 555 0142",
            Address = "Calle 85 # 12-34, Bogotá",
            City = "Bogotá",
            Country = "Colombia",
            Currency = "USD",
            CurrencySymbol = "$",
            Locale = "es-CO",
            TimeZone = "America/Bogota",
            BusinessType = BusinessType.Retail,
            Description = "Concept store de moda, tecnología y belleza. Productos seleccionados para las personas que aman verse y sentirse bien.",
            TaxName = "IVA",
            TaxRate = 19,
            TaxIncluded = false,
            BusinessHours = "Lunes a sábado: 9:00 a.m. – 7:00 p.m. · Domingo: 10:00 a.m. – 4:00 p.m.",
            PaymentMethods = "Efectivo, tarjetas débito/crédito, transferencia bancaria, Nequi y Daviplata.",
            Website = "https://empirestore.co",
            Instagram = "@empirestore",
            Plan = Plan.Growth,
            TrialEndsAt = now.AddDays(9),
            CreatedAt = now.AddDays(-90)
        };
        db.Tenants.Add(tenant);

        var mainBranch = new Branch { TenantId = tenantId, Name = "Sede Principal", Code = "BOG-01", Address = "Calle 85 # 12-34", City = "Bogotá", Phone = "+57 320 555 0142", IsMain = true };
        var chapinero = new Branch { TenantId = tenantId, Name = "Chapinero", Code = "BOG-02", Address = "Cra. 13 # 54-20", City = "Bogotá", Phone = "+57 320 555 0199" };
        var medellin = new Branch { TenantId = tenantId, Name = "Medellín", Code = "MDE-01", Address = "Cra. 43A # 1-50", City = "Medellín", Phone = "+57 320 555 0177" };
        db.Branches.AddRange(mainBranch, chapinero, medellin);

        var owner = new User
        {
            TenantId = tenantId,
            FullName = "Valentina Ríos",
            Email = "demo@nexcomerce.app",
            PasswordHash = PasswordHasher.Hash("Demo1234!"),
            Phone = "+57 320 555 0142",
            Role = UserRole.Owner,
            BranchId = mainBranch.Id,
            Permissions = string.Join(',', Permissions.All),
            CreatedAt = now.AddDays(-90),
            LastLoginAt = now.AddHours(-2)
        };
        var manager = new User
        {
            TenantId = tenantId,
            FullName = "Camila Torres",
            Email = "camila@empirestore.co",
            PasswordHash = PasswordHasher.Hash("Demo1234!"),
            Phone = "+57 310 222 3344",
            Role = UserRole.Manager,
            BranchId = mainBranch.Id,
            Permissions = string.Join(',', Permissions.DefaultFor(UserRole.Manager)),
            CreatedAt = now.AddDays(-70)
        };
        var cashier = new User
        {
            TenantId = tenantId,
            FullName = "Andrés Gómez",
            Email = "andres@empirestore.co",
            PasswordHash = PasswordHasher.Hash("Demo1234!"),
            Phone = "+57 301 888 1122",
            Role = UserRole.Cashier,
            BranchId = chapinero.Id,
            Permissions = string.Join(',', Permissions.DefaultFor(UserRole.Cashier)),
            CreatedAt = now.AddDays(-45)
        };
        var warehouse = new User
        {
            TenantId = tenantId,
            FullName = "Sofía Herrera",
            Email = "sofia@empirestore.co",
            PasswordHash = PasswordHasher.Hash("Demo1234!"),
            Phone = "+57 315 777 9900",
            Role = UserRole.Warehouse,
            BranchId = medellin.Id,
            Permissions = string.Join(',', Permissions.DefaultFor(UserRole.Warehouse)),
            CreatedAt = now.AddDays(-30)
        };
        db.Users.AddRange(owner, manager, cashier, warehouse);

        var categories = new List<Category>
        {
            new() { TenantId = tenantId, Name = "Ropa", Color = "#7C3AED", Icon = "shirt" },
            new() { TenantId = tenantId, Name = "Tecnología", Color = "#2563EB", Icon = "smartphone" },
            new() { TenantId = tenantId, Name = "Belleza", Color = "#DB2777", Icon = "sparkles" },
            new() { TenantId = tenantId, Name = "Calzado", Color = "#EA580C", Icon = "footprints" },
            new() { TenantId = tenantId, Name = "Accesorios", Color = "#0891B2", Icon = "watch" },
            new() { TenantId = tenantId, Name = "Servicios", Color = "#059669", Icon = "wrench" }
        };
        db.Categories.AddRange(categories);

        Product P(string name, string sku, Guid cat, decimal price, decimal cost, int stock, int min, string? brand = null, string? desc = null, string? image = null) =>
            new()
            {
                TenantId = tenantId, Name = name, Sku = sku, CategoryId = cat, Price = price, Cost = cost,
                Stock = stock, MinStock = min, Brand = brand, Description = desc, ImageUrl = image, TrackStock = true
            };

        var products = new List<Product>
        {
            P("Camiseta Oversize Essential", "ROP-001", categories[0].Id, 39.90m, 16m, 42, 10, "Empire Basics", "Camiseta de algodón orgánico 100%, corte oversize unisex.", "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80"),
            P("Jean Slim Fit Denim", "ROP-002", categories[0].Id, 79.90m, 34m, 18, 8, "Empire Denim", "Jean de denim elástico con corte slim y acabado oscuro.", "https://images.unsplash.com/photo-1542272604-787c3835535d?w=600&q=80"),
            P("Vestido Lino Aurora", "ROP-003", categories[0].Id, 94.50m, 41m, 7, 8, "Aurora", "Vestido en lino fresco con caída fluida, ideal para clima cálido.", "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&q=80"),
            P("Chaqueta Bomber Urban", "ROP-004", categories[0].Id, 129.00m, 58m, 11, 6, "Empire", "Chaqueta bomber water-repellent con forro térmico.", "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&q=80"),
            P("Blusa Satin Cloud", "ROP-005", categories[0].Id, 54.90m, 22m, 23, 10, "Aurora", "Blusa satinada con mangas largas y detalle de botones.", "https://images.unsplash.com/photo-1564257577030-2d2d1e6e6a8f?w=600&q=80"),
            P("Audífonos Bluetooth Pulse Pro", "TEC-001", categories[1].Id, 89.90m, 42m, 25, 8, "Pulse", "Cancelación activa de ruido, 32 h de batería y estuche de carga.", "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80"),
            P("Smartwatch Nova S2", "TEC-002", categories[1].Id, 149.00m, 71m, 9, 6, "Nova", "Pantalla AMOLED, GPS, monitor de sueño y 7 días de autonomía.", "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80"),
            P("Teclado Mecánico K68", "TEC-003", categories[1].Id, 69.50m, 30m, 4, 5, "KeyOne", "Teclado 65% hot-swap con switches lineales y RGB.", "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&q=80"),
            P("Parlante Mini Boom", "TEC-004", categories[1].Id, 49.90m, 19m, 31, 10, "Pulse", "Parlante portátil IPX7 con 12 h de reproducción.", "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&q=80"),
            P("Cargador GaN 65W", "TEC-005", categories[1].Id, 34.90m, 12m, 0, 8, "Volt", "Cargador compacto de 3 puertos para laptop, tablet y celular.", "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&q=80"),
            P("Sérum Vitamina C Glow", "BEL-001", categories[2].Id, 28.50m, 9m, 36, 12, "Lumière", "Sérum facial antioxidante con 12% de vitamina C pura.", "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=600&q=80"),
            P("Labial Matte Velvet", "BEL-002", categories[2].Id, 18.90m, 5m, 58, 15, "Lumière", "Labial de larga duración con acabado terciopelo.", "https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=600&q=80"),
            P("Crema Hidratante Hydra", "BEL-003", categories[2].Id, 32.00m, 11m, 12, 10, "Dermé", "Hidratación profunda 48 h con ácido hialurónico.", "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&q=80"),
            P("Perfume Amber Nuit 50ml", "BEL-004", categories[2].Id, 78.00m, 29m, 6, 5, "Maison Nuit", "Fragancia ámbar amaderada de larga fijación.", "https://images.unsplash.com/photo-1541643600914-78b084683601?w=600&q=80"),
            P("Sneakers Court Classic", "CAL-001", categories[3].Id, 89.00m, 38m, 20, 8, "Empire", "Sneakers de cuero vegano con suela de goma reciclada.", "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600&q=80"),
            P("Botines Chelsea Norte", "CAL-002", categories[3].Id, 119.00m, 52m, 3, 6, "Norte", "Botines de cuero con elástico lateral y suela track.", "https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=600&q=80"),
            P("Gafas de Sol Wave", "ACC-001", categories[4].Id, 45.00m, 14m, 27, 10, "Wave", "Gafas polarizadas con protección UV400.", "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=600&q=80"),
            P("Bolso Tote Lona", "ACC-002", categories[4].Id, 42.00m, 15m, 16, 8, "Empire", "Bolso tote de lona resistente con bolsillo interno.", "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80"),
            P("Reloj Minimal Steel", "ACC-003", categories[4].Id, 135.00m, 61m, 5, 5, "Nova", "Reloj de acero inoxidable con movimiento japonés.", "https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=600&q=80"),
            P("Gorra Logo Bordado", "ACC-004", categories[4].Id, 24.90m, 8m, 44, 12, "Empire", "Gorra de algodón con logo bordado y cierre ajustable.", "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=600&q=80"),
            new() { TenantId = tenantId, Name = "Personal Shopper", Sku = "SRV-001", CategoryId = categories[5].Id, Type = ProductType.Service, Price = 60.00m, Cost = 20m, TrackStock = false, Description = "Asesoría de imagen y compras personalizadas de 60 minutos.", Unit = "sesión", ImageUrl = "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&q=80" },
            new() { TenantId = tenantId, Name = "Ajuste de prendas", Sku = "SRV-002", CategoryId = categories[5].Id, Type = ProductType.Service, Price = 15.00m, Cost = 4m, TrackStock = false, Description = "Ajuste y arreglo de prendas a la medida.", Unit = "prenda", ImageUrl = "https://images.unsplash.com/photo-1528570211721-25b8b5b3b1e8?w=600&q=80" }
        };
        db.Products.AddRange(products);

        // Variants for clothing and footwear
        var variantSource = new (string Sku, string[] Values)[]
        {
            ("ROP-001", ["S / Blanco", "M / Blanco", "L / Negro", "XL / Negro"]),
            ("ROP-002", ["30 / Azul", "32 / Azul", "34 / Negro", "36 / Negro"]),
            ("ROP-003", ["S / Beige", "M / Beige", "L / Verde"]),
            ("CAL-001", ["38 / Blanco", "40 / Blanco", "42 / Negro"]),
            ("BEL-002", ["Rojo Velvet", "Nude Velvet", "Vino Tinto"])
        };
        foreach (var (sku, values) in variantSource)
        {
            var product = products.First(p => p.Sku == sku);
            var per = Math.Max(1, (product.Stock + product.MinStock) / values.Length);
            foreach (var value in values)
            {
                product.Variants.Add(new ProductVariant
                {
                    TenantId = tenantId,
                    ProductId = product.Id,
                    Name = value,
                    Sku = $"{sku}-{value.Split('/')[0].Trim().Replace(" ", "")}",
                    Stock = per,
                    Price = product.Price
                });
            }
        }

        var customers = new List<Customer>
        {
            new() { TenantId = tenantId, Name = "Mariana López", Phone = "+57 311 234 5678", Email = "mariana.lopez@gmail.com", DocumentNumber = "1023456789", Tags = "VIP", LoyaltyPoints = 340, Address = "Cra. 15 # 90-12, Bogotá" },
            new() { TenantId = tenantId, Name = "Santiago Pérez", Phone = "+57 312 876 5432", Email = "santiago.perez@gmail.com", Tags = "Frecuente", LoyaltyPoints = 120 },
            new() { TenantId = tenantId, Name = "Laura Jiménez", Phone = "+57 315 555 0102", Email = "laura.jimenez@hotmail.com", Tags = "VIP", LoyaltyPoints = 510, Address = "Calle 70 # 5-40" },
            new() { TenantId = tenantId, Name = "Daniela Castro", Phone = "+57 316 444 8899", Email = "daniela.castro@gmail.com", Tags = "Nueva", LoyaltyPoints = 20 },
            new() { TenantId = tenantId, Name = "Felipe Ramírez", Phone = "+57 318 222 1100", Email = "felipe.ramirez@gmail.com", LoyaltyPoints = 75 },
            new() { TenantId = tenantId, Name = "Isabella Moreno", Phone = "+57 310 999 8877", Email = "isa.moreno@gmail.com", Tags = "Frecuente", LoyaltyPoints = 210 },
            new() { TenantId = tenantId, Name = "Sebastián Díaz", Phone = "+57 313 111 2233", Email = "sebas.diaz@gmail.com", LoyaltyPoints = 45 },
            new() { TenantId = tenantId, Name = "Valeria Ortiz", Phone = "+57 314 333 4455", Email = "valeria.ortiz@gmail.com", Tags = "VIP", LoyaltyPoints = 680 },
            new() { TenantId = tenantId, Name = "Andrés Mejía", Phone = "+57 317 666 7788", Email = "andres.mejia@gmail.com", LoyaltyPoints = 95 },
            new() { TenantId = tenantId, Name = "Carolina Rojas", Phone = "+57 319 000 1122", Email = "caro.rojas@gmail.com", Tags = "Nueva", LoyaltyPoints = 10 }
        };
        db.Customers.AddRange(customers);

        var suppliers = new List<Supplier>
        {
            new() { TenantId = tenantId, Name = "Textiles del Norte S.A.S.", ContactName = "Jorge Molina", Phone = "+57 601 555 0101", Email = "ventas@textilesnorte.co", DocumentNumber = "900.123.456-1", Address = "Medellín" },
            new() { TenantId = tenantId, Name = "Tech Import Group", ContactName = "Paula Rincón", Phone = "+57 601 555 0202", Email = "compras@techimport.co", DocumentNumber = "901.456.789-2", Address = "Bogotá" },
            new() { TenantId = tenantId, Name = "Lumière Beauty Lab", ContactName = "Natalia Cruz", Phone = "+57 604 555 0303", Email = "hola@lumierelab.co", DocumentNumber = "900.789.123-3", Address = "Medellín" },
            new() { TenantId = tenantId, Name = "Distribuciones Andinas", ContactName = "Carlos Peña", Phone = "+57 601 555 0404", Email = "pedidos@distriandinas.co", DocumentNumber = "890.321.654-4", Address = "Bogotá" }
        };
        db.Suppliers.AddRange(suppliers);

        var expenseSeed = new (string Cat, string Desc, decimal Amount, int DaysAgo, PaymentMethod Pay)[]
        {
            ("Arriendo", "Arriendo local sede principal", 2400m, 25, PaymentMethod.Transfer),
            ("Nómina", "Pago de nómina quincenal", 3800m, 20, PaymentMethod.Transfer),
            ("Marketing", "Pauta en redes sociales", 450m, 15, PaymentMethod.Card),
            ("Servicios", "Energía y agua", 280m, 12, PaymentMethod.Transfer),
            ("Logística", "Envíos y mensajería", 320m, 9, PaymentMethod.Cash),
            ("Insumos", "Empaques y bolsas", 180m, 7, PaymentMethod.Cash),
            ("Software", "Herramientas y suscripciones", 95m, 5, PaymentMethod.Card),
            ("Marketing", "Influencer colaboración", 600m, 3, PaymentMethod.Transfer),
            ("Mantenimiento", "Mantenimiento de vitrinas", 140m, 2, PaymentMethod.Cash),
            ("Arriendo", "Arriendo bodega", 900m, 1, PaymentMethod.Transfer)
        };
        foreach (var (cat, desc, amount, days, pay) in expenseSeed)
        {
            db.Expenses.Add(new Expense
            {
                TenantId = tenantId, Category = cat, Description = desc, Amount = amount,
                Date = now.AddDays(-days), PaymentMethod = pay, BranchId = mainBranch.Id,
                UserId = owner.Id, CreatedAt = now.AddDays(-days)
            });
        }

        // Historical sales (deterministic)
        var saleCounter = 1;
        var methods = new[] { PaymentMethod.Cash, PaymentMethod.Card, PaymentMethod.Card, PaymentMethod.Nequi, PaymentMethod.Transfer, PaymentMethod.Daviplata };
        var sellers = new[] { (owner.Id, owner.FullName), (cashier.Id, cashier.FullName), (manager.Id, manager.FullName) };
        var branches = new[] { mainBranch, chapinero, medellin };
        for (var day = 44; day >= 0; day--)
        {
            var date = now.AddDays(-day);
            var dailySales = day == 0 ? 6 : rnd.Next(3, 8);
            for (var s = 0; s < dailySales; s++)
            {
                var seller = sellers[rnd.Next(sellers.Length)];
                var branch = branches[rnd.Next(branches.Length)];
                var customer = rnd.Next(3) == 0 ? null : customers[rnd.Next(customers.Count)];
                var sale = new Sale
                {
                    TenantId = tenantId,
                    Number = $"V-{date:yyMM}-{saleCounter:0000}",
                    BranchId = branch.Id,
                    CustomerId = customer?.Id,
                    CustomerName = customer?.Name ?? "Cliente ocasional",
                    UserId = seller.Item1,
                    UserName = seller.Item2,
                    PaymentMethod = methods[rnd.Next(methods.Length)],
                    Status = SaleStatus.Completed,
                    Channel = rnd.Next(4) == 0 ? "WhatsApp" : "POS",
                    CreatedAt = date.Date.AddHours(rnd.Next(9, 19)).AddMinutes(rnd.Next(0, 59))
                };
                var itemCount = rnd.Next(1, 4);
                for (var i = 0; i < itemCount; i++)
                {
                    var product = products[rnd.Next(products.Count)];
                    var qty = rnd.Next(1, 3);
                    var price = product.Price;
                    sale.Items.Add(new SaleItem
                    {
                        TenantId = tenantId,
                        ProductId = product.Id,
                        ProductName = product.Name,
                        Sku = product.Sku,
                        Quantity = qty,
                        UnitPrice = price,
                        UnitCost = product.Cost,
                        Total = price * qty,
                        CreatedAt = sale.CreatedAt
                    });
                }
                sale.Subtotal = sale.Items.Sum(i => i.Total);
                sale.Discount = rnd.Next(6) == 0 ? Math.Round(sale.Subtotal * 0.1m, 2) : 0;
                sale.Tax = Math.Round((sale.Subtotal - sale.Discount) * 0.19m, 2);
                sale.Total = sale.Subtotal - sale.Discount + sale.Tax;
                sale.PaidAmount = sale.PaymentMethod == PaymentMethod.Cash ? Math.Ceiling(sale.Total / 10) * 10 : sale.Total;
                sale.Change = sale.PaidAmount - sale.Total;
                db.Sales.Add(sale);
                saleCounter++;
            }
        }

        // Recent inventory movements (only physical products tracked in stock)
        var movementNotes = new[] { "Compra a proveedor", "Reposición de stock", "Devolución de cliente", "Ajuste por inventario físico", "Producto dañado" };
        var stockProducts = products.Where(p => p.TrackStock && p.Type == ProductType.Product && p.Stock > 0).ToList();
        for (var i = 0; i < stockProducts.Count; i++)
        {
            var product = stockProducts[i];
            var type = (i % 5) switch { 0 => MovementType.In, 1 => MovementType.In, 2 => MovementType.Out, 3 => MovementType.Adjustment, _ => MovementType.Return };
            var qty = Math.Min(rnd.Next(1, 12), product.Stock);
            var isEntry = type is MovementType.In or MovementType.Return;
            db.InventoryMovements.Add(new InventoryMovement
            {
                TenantId = tenantId,
                ProductId = product.Id,
                BranchId = mainBranch.Id,
                Type = type,
                Quantity = qty,
                PreviousStock = isEntry ? Math.Max(0, product.Stock - qty) : product.Stock + qty,
                NewStock = product.Stock,
                Notes = movementNotes[rnd.Next(movementNotes.Length)],
                Reference = $"MOV-{1000 + i}",
                ProductName = product.Name,
                UserId = warehouse.Id,
                UserName = warehouse.FullName,
                CreatedAt = now.AddDays(-rnd.Next(0, 30)).AddHours(rnd.Next(0, 8))
            });
        }

        var wa = new WhatsAppAccount
        {
            TenantId = tenantId,
            WabaId = "1029384756",
            PhoneNumberId = "109876543210987",
            DisplayPhoneNumber = "+57 320 555 0142",
            VerifyToken = "empire-verify-2026",
            IsEnabled = true,
            AiEnabled = true,
            AiModel = "gpt-4o-mini",
            ConnectedAt = now.AddDays(-60),
            BusinessHoursText = "Lunes a sábado de 9:00 a.m. a 7:00 p.m. y domingos de 10:00 a.m. a 4:00 p.m.",
            LocationText = "Estamos en Calle 85 # 12-34, Bogotá (sede principal). También tenemos sedes en Chapinero y Medellín.",
            PaymentMethodsText = "Aceptamos efectivo, tarjetas débito y crédito, transferencia bancaria, Nequi y Daviplata. También puedes pagar contra entrega en Bogotá.",
            ServicesText = "Ofrecemos envío nacional, cambio de talla sin costo dentro de 30 días, personal shopper y ajuste de prendas.",
            SystemPrompt = "Eres el asistente virtual de Empire Store. Responde en español, con tono cercano y profesional. Sé breve (máximo 3 frases), usa emojis con moderación y nunca inventes precios ni disponibilidad."
        };
        db.WhatsAppAccounts.Add(wa);

        var faqs = new List<WhatsAppFaq>
        {
            new() { TenantId = tenantId, Question = "¿Hacen envíos?", Answer = "¡Sí! Hacemos envíos a todo el país. En Bogotá la entrega tarda 1–2 días hábiles y a nivel nacional 3–5 días. El envío es gratis en compras superiores a $80.", Keywords = "envio,envío,domicilio,despacho,entrega,llega", Priority = 10 },
            new() { TenantId = tenantId, Question = "¿Cuál es la política de cambios y devoluciones?", Answer = "Puedes cambiar talla o color dentro de los 30 días con la prenda sin uso y la etiqueta original. Los cambios de talla son gratis en tienda.", Keywords = "cambio,devolucion,devolución,garantia,garantía,talla", Priority = 9 },
            new() { TenantId = tenantId, Question = "¿Tienen descuentos?", Answer = "Tenemos 10% de descuento en tu primera compra con el código BIENVENIDA y promociones semanales para clientes del club Empire.", Keywords = "descuento,promo,promoción,oferta,cupon,cupón", Priority = 6 },
            new() { TenantId = tenantId, Question = "¿Cómo hago un pedido?", Answer = "Puedes pedir por este chat: cuéntame qué producto te gusta y tu talla, y te genero el pedido con envío o recogida en tienda.", Keywords = "pedido,comprar,orden,reservar", Priority = 8 },
            new() { TenantId = tenantId, Question = "¿Aceptan pagos con tarjeta?", Answer = "Sí, aceptamos tarjetas débito y crédito, además de efectivo, Nequi, Daviplata y transferencias.", Keywords = "pago,pagar,tarjeta,nequi,daviplata,efectivo", Priority = 7 }
        };
        db.WhatsAppFaqs.AddRange(faqs);

        var conversationsSeed = new (string Name, string Phone, ConversationStatus Status, string Last, int HoursAgo, bool Unread)[]
        {
            ("Mariana López", "+57 311 234 5678", ConversationStatus.Bot, "¿Tienen la camiseta oversize en talla M?", 1, true),
            ("Santiago Pérez", "+57 312 876 5432", ConversationStatus.Human, "Perfecto, entonces reservo el smartwatch.", 2, true),
            ("Laura Jiménez", "+57 315 555 0102", ConversationStatus.Bot, "Gracias, ¡ya hice el pedido! 💜", 4, false),
            ("Daniela Castro", "+57 316 444 8899", ConversationStatus.Closed, "Listo, muchas gracias por la info.", 26, false),
            ("Felipe Ramírez", "+57 318 222 1100", ConversationStatus.Bot, "¿Cuánto cuesta el envío a Medellín?", 30, true)
        };

        var waMessages = new Dictionary<string, (string In, string Out, string Intent)>
        {
            ["+57 311 234 5678"] = ("Hola, ¿tienen la camiseta oversize en talla M?", "¡Hola! 👋 Sí, la Camiseta Oversize Essential está disponible en talla M por $39.90. ¿Te la reservo? 💜", "product"),
            ["+57 312 876 5432"] = ("Me interesa el smartwatch Nova S2, ¿tienen disponible?", "Sí, el Smartwatch Nova S2 está disponible por $149.00. ¿Quieres que un asesor te ayude con la compra?", "product"),
            ["+57 315 555 0102"] = ("¿Cuánto demora el envío a mi casa?", "En Bogotá la entrega tarda 1–2 días hábiles y es gratis en compras superiores a $80. 🚚", "faq"),
            ["+57 316 444 8899"] = ("¿Cuál es el horario de atención?", "Atendemos de lunes a sábado de 9:00 a.m. a 7:00 p.m. y domingos de 10:00 a.m. a 4:00 p.m. 🕘", "hours"),
            ["+57 318 222 1100"] = ("Hola, quiero saber el precio de los audífonos Bluetooth", "Los Audífonos Bluetooth Pulse Pro cuestan $89.90 y tienen 25 unidades disponibles. 🎧", "product")
        };

        foreach (var (name, phone, status, last, hoursAgo, unread) in conversationsSeed)
        {
            var contact = new WhatsAppContact
            {
                TenantId = tenantId, WaId = phone, Phone = phone, Name = name,
                LastMessageAt = now.AddHours(-hoursAgo), UnreadCount = unread ? 2 : 0
            };
            db.WhatsAppContacts.Add(contact);
            var conversation = new Conversation
            {
                TenantId = tenantId,
                ContactId = contact.Id,
                Status = status,
                AssignedUserId = status == ConversationStatus.Human ? owner.Id : null,
                AssignedUserName = status == ConversationStatus.Human ? owner.FullName : null,
                LastMessagePreview = last,
                LastMessageAt = now.AddHours(-hoursAgo),
                MessageCount = 4,
                CreatedAt = now.AddDays(-2)
            };
            db.Conversations.Add(conversation);

            var (inMsg, outMsg, intent) = waMessages[phone];
            db.Messages.AddRange(
                new Message { TenantId = tenantId, ConversationId = conversation.Id, Direction = MessageDirection.Inbound, Body = "Hola, buenas tardes 👋", CreatedAt = now.AddHours(-hoursAgo).AddMinutes(-9), Status = "received" },
                new Message { TenantId = tenantId, ConversationId = conversation.Id, Direction = MessageDirection.Outbound, Body = "¡Hola! Bienvenido a Empire Store 💜 ¿En qué te puedo ayudar hoy?", IsAutomated = true, Intent = "greeting", CreatedAt = now.AddHours(-hoursAgo).AddMinutes(-8), Status = "delivered" },
                new Message { TenantId = tenantId, ConversationId = conversation.Id, Direction = MessageDirection.Inbound, Body = inMsg, CreatedAt = now.AddHours(-hoursAgo).AddMinutes(-5), Status = "received" },
                new Message { TenantId = tenantId, ConversationId = conversation.Id, Direction = MessageDirection.Outbound, Body = outMsg, IsAutomated = status != ConversationStatus.Human, Intent = intent, CreatedAt = now.AddHours(-hoursAgo).AddMinutes(-4), Status = "delivered" }
            );
        }

        await db.SaveChangesAsync();
        db.TenantBypass = false;
    }
}
