import { db } from "@workspace/db";
import {
  tenantsTable, usersTable, departmentsTable, attendanceTable,
  projectsTable, projectTasksTable, billingPlansTable, subscriptionsTable,
  invoicesTable, campaignsTable
} from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("Seeding database...");

  // Billing Plans
  const plans = await db.insert(billingPlansTable).values([
    { name: "Free", slug: "free", price: "0", billingCycle: "monthly", maxUsers: 5, maxProjects: 3, features: ["Up to 5 users", "3 projects", "Basic attendance", "Email support"] },
    { name: "Starter", slug: "starter", price: "29", billingCycle: "monthly", maxUsers: 25, maxProjects: 15, features: ["Up to 25 users", "15 projects", "Attendance tracking", "Marketing tools", "Priority support"] },
    { name: "Professional", slug: "professional", price: "79", billingCycle: "monthly", maxUsers: 100, maxProjects: 50, features: ["Up to 100 users", "50 projects", "Advanced analytics", "All modules", "Phone support"] },
    { name: "Enterprise", slug: "enterprise", price: "249", billingCycle: "monthly", maxUsers: null, maxProjects: null, features: ["Unlimited users", "Unlimited projects", "Custom integrations", "Dedicated manager", "SLA"] },
  ]).onConflictDoNothing().returning();
  console.log(`Created ${plans.length} billing plans`);

  // Tenant: System for Super Admin
  const [systemTenant] = await db.insert(tenantsTable).values({
    name: "BizAuto System",
    slug: "bizauto-system",
    plan: "enterprise",
    isActive: true,
  }).onConflictDoNothing().returning();

  const hash = await bcrypt.hash("password", 10);

  // Super Admin
  if (systemTenant) {
    await db.insert(usersTable).values({
      tenantId: systemTenant.id,
      email: "admin@demo.com",
      passwordHash: hash,
      firstName: "Super",
      lastName: "Admin",
      role: "super_admin",
    }).onConflictDoNothing();
    console.log("Created super admin: admin@demo.com / password");
  }

  // Demo Organization
  const [demoTenant] = await db.insert(tenantsTable).values({
    name: "Acme Corporation",
    slug: "acme-corp",
    plan: "professional",
    isActive: true,
  }).onConflictDoNothing().returning();

  if (demoTenant) {
    // Org Admin
    const [orgAdmin] = await db.insert(usersTable).values({
      tenantId: demoTenant.id,
      email: "orgadmin@demo.com",
      passwordHash: hash,
      firstName: "John",
      lastName: "Smith",
      role: "org_admin",
    }).onConflictDoNothing().returning();
    console.log("Created org admin: orgadmin@demo.com / password");

    // Departments
    const [engDept] = await db.insert(departmentsTable).values({
      tenantId: demoTenant.id,
      name: "Engineering",
      description: "Software development and infrastructure",
    }).onConflictDoNothing().returning();

    const [marketingDept] = await db.insert(departmentsTable).values({
      tenantId: demoTenant.id,
      name: "Marketing",
      description: "Digital marketing and brand management",
    }).onConflictDoNothing().returning();

    const [hrDept] = await db.insert(departmentsTable).values({
      tenantId: demoTenant.id,
      name: "Human Resources",
      description: "People operations and talent management",
    }).onConflictDoNothing().returning();

    const [salesDept] = await db.insert(departmentsTable).values({
      tenantId: demoTenant.id,
      name: "Sales",
      description: "Revenue generation and client acquisition",
    }).onConflictDoNothing().returning();

    if (engDept) {
      // Department Head
      const [deptHead] = await db.insert(usersTable).values({
        tenantId: demoTenant.id,
        departmentId: engDept.id,
        email: "depthead@demo.com",
        passwordHash: hash,
        firstName: "Sarah",
        lastName: "Johnson",
        role: "department_head",
        phone: "+1-555-0102",
      }).onConflictDoNothing().returning();
      console.log("Created dept head: depthead@demo.com / password");

      if (deptHead) {
        await db.update(departmentsTable).set({ headUserId: deptHead.id }).where(
          eq(departmentsTable.id, engDept.id)
        );
      }

      // Employee
      const [employee] = await db.insert(usersTable).values({
        tenantId: demoTenant.id,
        departmentId: engDept.id,
        email: "employee@demo.com",
        passwordHash: hash,
        firstName: "Mike",
        lastName: "Davis",
        role: "employee",
        phone: "+1-555-0103",
      }).onConflictDoNothing().returning();
      console.log("Created employee: employee@demo.com / password");

      // More employees
      const employees = await db.insert(usersTable).values([
        { tenantId: demoTenant.id, departmentId: engDept.id, email: "alice@demo.com", passwordHash: hash, firstName: "Alice", lastName: "Wong", role: "employee" },
        { tenantId: demoTenant.id, departmentId: marketingDept?.id, email: "bob@demo.com", passwordHash: hash, firstName: "Bob", lastName: "Chen", role: "employee" },
        { tenantId: demoTenant.id, departmentId: hrDept?.id, email: "carol@demo.com", passwordHash: hash, firstName: "Carol", lastName: "White", role: "department_head" },
        { tenantId: demoTenant.id, departmentId: salesDept?.id, email: "dave@demo.com", passwordHash: hash, firstName: "Dave", lastName: "Brown", role: "employee" },
      ]).onConflictDoNothing().returning();

      // Attendance records (last 7 days)
      const allEmployeeIds = [employee?.id, ...employees.map(e => e.id)].filter(Boolean) as number[];
      const statuses: Array<"present" | "absent" | "late" | "half_day" | "leave"> = ["present", "present", "present", "late", "absent"];
      for (let d = 6; d >= 0; d--) {
        const date = new Date();
        date.setDate(date.getDate() - d);
        const dateStr = date.toISOString().split("T")[0];
        for (const empId of allEmployeeIds) {
          const status = statuses[Math.floor(Math.random() * statuses.length)];
          await db.insert(attendanceTable).values({
            userId: empId,
            tenantId: demoTenant.id,
            date: dateStr,
            checkIn: status !== "absent" ? "09:00" : null,
            checkOut: status !== "absent" ? "18:00" : null,
            status,
          }).onConflictDoNothing();
        }
      }
      console.log("Created attendance records");

      // Projects
      const [proj1] = await db.insert(projectsTable).values({
        tenantId: demoTenant.id,
        departmentId: engDept.id,
        name: "Platform Redesign",
        description: "Complete redesign of the main platform UI",
        status: "active",
        priority: "high",
        startDate: "2026-01-01",
        endDate: "2026-06-30",
        budget: "150000",
        progress: 45,
        managerId: deptHead?.id,
      }).onConflictDoNothing().returning();

      const [proj2] = await db.insert(projectsTable).values({
        tenantId: demoTenant.id,
        departmentId: engDept.id,
        name: "Mobile App Development",
        description: "Native mobile application for iOS and Android",
        status: "planning",
        priority: "medium",
        startDate: "2026-04-01",
        endDate: "2026-12-31",
        budget: "200000",
        progress: 10,
        managerId: deptHead?.id,
      }).onConflictDoNothing().returning();

      const [proj3] = await db.insert(projectsTable).values({
        tenantId: demoTenant.id,
        departmentId: marketingDept?.id,
        name: "Q1 Marketing Campaign",
        description: "Digital marketing campaign for Q1 product launch",
        status: "completed",
        priority: "high",
        startDate: "2026-01-01",
        endDate: "2026-03-31",
        budget: "50000",
        progress: 100,
      }).onConflictDoNothing().returning();

      // Tasks for proj1
      if (proj1 && employee) {
        await db.insert(projectTasksTable).values([
          { projectId: proj1.id, title: "Design system audit", status: "done", priority: "high", assigneeId: employee.id },
          { projectId: proj1.id, title: "Component library setup", status: "done", priority: "high", assigneeId: employee.id },
          { projectId: proj1.id, title: "Homepage redesign", status: "in_progress", priority: "medium", assigneeId: employee.id, dueDate: "2026-04-15" },
          { projectId: proj1.id, title: "Dashboard redesign", status: "in_progress", priority: "medium", assigneeId: deptHead?.id, dueDate: "2026-04-30" },
          { projectId: proj1.id, title: "Mobile responsiveness", status: "todo", priority: "low", dueDate: "2026-05-30" },
          { projectId: proj1.id, title: "User testing", status: "todo", priority: "medium", dueDate: "2026-06-15" },
        ]).onConflictDoNothing();
        console.log("Created project tasks");
      }
    }

    // Campaigns
    await db.insert(campaignsTable).values([
      {
        tenantId: demoTenant.id,
        name: "Spring Product Launch",
        type: "email",
        status: "completed",
        subject: "Introducing our newest features",
        content: "We are excited to announce our spring product launch...",
        targetAudience: "All customers",
        sentCount: 5420,
        openCount: 1842,
        clickCount: 634,
      },
      {
        tenantId: demoTenant.id,
        name: "Re-engagement Campaign",
        type: "email",
        status: "running",
        subject: "We miss you! Come back for exclusive offers",
        content: "It's been a while...",
        targetAudience: "Inactive users",
        sentCount: 2100,
        openCount: 567,
        clickCount: 145,
      },
      {
        tenantId: demoTenant.id,
        name: "Social Media Boost",
        type: "social",
        status: "scheduled",
        subject: null,
        content: "Brand awareness social campaign for Q2",
        targetAudience: "New prospects",
        scheduledAt: new Date("2026-04-01"),
        sentCount: 0,
        openCount: 0,
        clickCount: 0,
      },
      {
        tenantId: demoTenant.id,
        name: "SMS Flash Sale",
        type: "sms",
        status: "draft",
        content: "FLASH SALE: 30% off all plans today only!",
        targetAudience: "Trial users",
        sentCount: 0,
        openCount: 0,
        clickCount: 0,
      },
    ]).onConflictDoNothing();
    console.log("Created campaigns");

    // Invoices
    const starterPlan = plans.find(p => p.slug === "professional");
    if (starterPlan) {
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      await db.insert(subscriptionsTable).values({
        tenantId: demoTenant.id,
        planId: starterPlan.id,
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        amount: starterPlan.price,
      }).onConflictDoNothing();
    }

    await db.insert(invoicesTable).values([
      { tenantId: demoTenant.id, amount: "79.00", status: "paid", dueDate: "2026-01-31", paidAt: new Date("2026-01-28"), description: "Professional Plan - January 2026" },
      { tenantId: demoTenant.id, amount: "79.00", status: "paid", dueDate: "2026-02-28", paidAt: new Date("2026-02-26"), description: "Professional Plan - February 2026" },
      { tenantId: demoTenant.id, amount: "79.00", status: "open", dueDate: "2026-03-31", description: "Professional Plan - March 2026" },
    ]).onConflictDoNothing();
    console.log("Created invoices");
  }

  // Second demo tenant
  const [tenant2] = await db.insert(tenantsTable).values({
    name: "TechStart Inc",
    slug: "techstart-inc",
    plan: "starter",
    isActive: true,
  }).onConflictDoNothing().returning();

  if (tenant2) {
    const hash2 = await bcrypt.hash("password", 10);
    await db.insert(usersTable).values({
      tenantId: tenant2.id,
      email: "admin@techstart.com",
      passwordHash: hash2,
      firstName: "Emma",
      lastName: "Wilson",
      role: "org_admin",
    }).onConflictDoNothing();

    await db.insert(invoicesTable).values([
      { tenantId: tenant2.id, amount: "29.00", status: "paid", dueDate: "2026-02-28", paidAt: new Date("2026-02-25"), description: "Starter Plan - February 2026" },
      { tenantId: tenant2.id, amount: "29.00", status: "open", dueDate: "2026-03-31", description: "Starter Plan - March 2026" },
    ]).onConflictDoNothing();
    console.log("Created TechStart tenant");
  }

  console.log("\n✅ Seed completed!");
  console.log("\nDemo credentials:");
  console.log("  Super Admin:  admin@demo.com / password");
  console.log("  Org Admin:    orgadmin@demo.com / password");
  console.log("  Dept Head:    depthead@demo.com / password");
  console.log("  Employee:     employee@demo.com / password");
}

seed().catch(console.error).finally(() => process.exit(0));
