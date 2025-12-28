# Phase 2 - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Install Dependencies (30 seconds)
```bash
cd backend
npm install
cd ..
```

### Step 2: Run Migration (30 seconds)
```bash
cd backend
npm run migrate
cd ..
```

### Step 3: Setup CRM Permissions (30 seconds)
```bash
# Make script executable
chmod +x scripts/setup-crm.sh

# Run setup script
bash scripts/setup-crm.sh
```

### Step 4: Restart Services (2 minutes)
```bash
docker-compose down
docker-compose up -d
```

### Step 5: Configure Permissions (2 minutes)
1. Open browser: `http://localhost`
2. Login as admin
3. Go to **Admin → Roles**
4. Select a role (e.g., "Manager")
5. Click "Assign Permission"
6. Add these CRM permissions:
   - `crm.case.create`
   - `crm.case.view`
   - `crm.case.assign`
   - `crm.case.update_status`
   - `crm.case.upload_document`
   - `crm.case.add_note`

### Step 6: Test CRM (1 minute)
1. Navigate to **CRM → Cases**
2. Click **"New Case"**
3. Fill in the form:
   - Customer Name: "John Doe"
   - Customer Email: "john@example.com"
   - Customer Phone: "+1234567890"
   - Loan Type: "Personal Loan"
   - Loan Amount: 50000
4. Click **"Create Case"**
5. Click **"View"** on the created case
6. Try the actions:
   - Upload a document
   - Add a note
   - View timeline

## ✅ You're Done!

Your CRM is now fully operational.

## 🎯 What You Can Do Now

### Create Cases
- Navigate to CRM → Cases
- Click "New Case"
- Fill customer and loan details
- Submit

### Manage Cases
- View case list with filters
- Search by case number or customer name
- Filter by status
- Click "View" for details

### Assign Cases
- Open case detail
- Click "Assign"
- Enter user UUID
- Submit

### Update Status
- Open case detail
- Click "Update Status"
- Select new status
- Add remarks (optional)
- Submit

### Upload Documents
- Open case detail
- Click "Upload Document"
- Select file (max 10MB)
- Upload

### Add Notes
- Open case detail
- Click "Add Note"
- Enter note text
- Submit

### View Timeline
- Open case detail
- Scroll to timeline section
- See all activities in chronological order

## 📋 Common Tasks

### Get User UUID for Assignment
```sql
-- Connect to database
docker exec -it sourcecorp-postgres psql -U sourcecorp_user -d sourcecorp

-- List users
SELECT id, email, first_name, last_name FROM auth_schema.users;
```

### Check Audit Logs
```sql
-- View CRM audit logs
SELECT * FROM audit_schema.audit_logs 
WHERE resource_type = 'case' 
ORDER BY created_at DESC 
LIMIT 10;
```

### View All Cases (Admin)
```sql
-- View all cases
SELECT 
  case_number, 
  customer_name, 
  loan_type, 
  loan_amount, 
  current_status 
FROM crm_schema.cases 
ORDER BY created_at DESC;
```

## 🐛 Troubleshooting

### CRM menu not showing?
- Check user has `crm.case.view` permission
- Refresh the page
- Check browser console for errors

### Cannot create case?
- Check user has `crm.case.create` permission
- Verify all required fields are filled
- Check backend logs: `docker logs sourcecorp-backend`

### Cannot upload documents?
- Check user has `crm.case.upload_document` permission
- Verify file size is under 10MB
- Check uploads directory exists
- Check backend logs

### Cannot see cases?
- Non-admin users see only assigned cases
- Create a case first
- Assign case to user
- Or give user admin role

## 🔑 Default Permissions Setup

### For Employees
```
✅ crm.case.create
✅ crm.case.view
✅ crm.case.upload_document
✅ crm.case.add_note
```

### For Managers
```
✅ crm.case.create
✅ crm.case.view
✅ crm.case.assign
✅ crm.case.update_status
✅ crm.case.upload_document
✅ crm.case.add_note
```

### For Admins
```
✅ crm.case.create
✅ crm.case.view
✅ crm.case.view_all
✅ crm.case.assign
✅ crm.case.update_status
✅ crm.case.upload_document
✅ crm.case.add_note
```

## 📞 Need Help?

1. Check `PHASE2_COMPLETE.md` for detailed setup
2. Check `docs/CRM.md` for API documentation
3. Check `PHASE2_VERIFICATION.md` for troubleshooting
4. Review code comments in source files

## 🎉 Success Indicators

You'll know it's working when:
- ✅ CRM menu appears in sidebar
- ✅ Cases page loads without errors
- ✅ You can create a new case
- ✅ Case appears in the list
- ✅ You can view case details
- ✅ Timeline shows case creation event
- ✅ You can upload documents
- ✅ You can add notes
- ✅ Audit logs show your actions

## 🚦 Next Steps

Once CRM is working:
1. Create test cases with different loan types
2. Test assignment workflow
3. Test status transitions
4. Upload various document types
5. Add notes to track progress
6. Review timeline for complete history
7. Test with different user roles
8. Verify RBAC filtering works

## 💡 Pro Tips

1. **Use meaningful case notes** - They appear in timeline
2. **Add remarks when changing status** - Helps track decisions
3. **Upload all required documents** - Keep cases complete
4. **Assign cases promptly** - Don't leave them unassigned
5. **Check timeline regularly** - See all activities at a glance

---

**You're all set! Start managing loan cases with confidence.** 🎊

