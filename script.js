// ============================================================================
// GLOBAL VARIABLES & DATABASE INITIALIZATION
// ============================================================================
let db;
let currentShopID = localStorage.getItem('smartpos_shop_id') || null; 
let shopName = "My Shop"; 
let waNumber = "";

let customersDB = []; 
let productsDB = []; 
let salesHistoryDB = [];
let dueCollectionHistoryDB = []; 
let expensesDB = [];
let holdInvoices = []; 
let cartItems = [];

let currentCustomerDue = 0; 
let cartTotal = 0;
let currentCostTab = 'daily'; 
let salesChart; 
let advAnalyticsChart;
let activeLedgerCus = ""; 

// ============================================================================
// SYSTEM LOAD & SKELETON LOADER
// ============================================================================
document.addEventListener("DOMContentLoaded", () => {
    let skeleton = document.getElementById('skeleton-loader');
    if (skeleton) {
        skeleton.style.display = 'flex';
    }
    
    document.querySelector('.pos-container').style.display = 'none';
    let landing = document.getElementById('saas-landing');
    if (landing) {
        landing.style.display = 'none';
    }

    currentShopID = localStorage.getItem('smartpos_shop_id');
    if (!currentShopID || currentShopID === "null" || currentShopID === "undefined") {
        showLoginPage();
    }
});

// ============================================================================
// FIREBASE INITIALIZATION
// ============================================================================
window.onload = function() {
    const firebaseConfig = {
        apiKey: "AIzaSyBgMVRoxVXLJCiRny-YQj0Ug-z4g6gt4fQ",
        authDomain: "poss-daad9.firebaseapp.com",
        projectId: "poss-daad9",
        storageBucket: "poss-daad9.firebasestorage.app",
        messagingSenderId: "1056012130294",
        appId: "1:1056012130294:web:351d75ee2b8c9e1f9419d7"
    };

    if (typeof firebase !== 'undefined') {
        if (!firebase.apps.length) { 
            firebase.initializeApp(firebaseConfig); 
        }
        db = firebase.firestore();
        
        // CodePen safe persistence
        db.enablePersistence().catch(err => { 
            console.warn("Persistence not available in this environment.", err); 
        });
        
        initializeApp();
    } else {
        console.log("Firebase loaded offline.");
        initializeApp();
    }
};

function initializeApp() {
    currentShopID = localStorage.getItem('smartpos_shop_id');
    
    if (currentShopID && currentShopID !== "null" && currentShopID !== "undefined") {
        checkSubscription(); 
    }
    
    updateTime(); 
    setInterval(updateTime, 1000); 
    
    checkNetworkStatus(); 
    window.addEventListener('online', checkNetworkStatus); 
    window.addEventListener('offline', checkNetworkStatus);
}

// ============================================================================
// LOGIN & AUTHENTICATION SYSTEM (CODEPEN SAFE)
// ============================================================================
function showLoginPage() {
    let skeleton = document.getElementById('skeleton-loader');
    if (skeleton) skeleton.style.display = 'none';

    document.querySelector('.pos-container').style.display = 'none';
    
    let landing = document.getElementById('saas-landing');
    if (landing) { 
        landing.classList.remove('hidden'); 
        landing.style.display = 'flex'; 
    }
}

function showDashboard() {
    let skeleton = document.getElementById('skeleton-loader');
    if (skeleton) skeleton.style.display = 'none';

    let landing = document.getElementById('saas-landing');
    if (landing) landing.style.display = 'none';

    document.querySelector('.pos-container').style.display = 'flex';
    finalizeUIRender();
}

function guestLogin() {
    let phone = prompt("১৫ দিনের ফ্রি ট্রায়াল শুরু করতে আপনার মোবাইল নাম্বারটি দিন (ex: 017...):");
    
    if (!phone) return; 
    
    phone = phone.trim();
    if (phone.length < 11) { 
        alert("❌ সঠিক মোবাইল নাম্বার দেওয়া আবশ্যক!"); 
        return; 
    }
    
    let trialStart = Date.now(); 
    let shopID = "TRIAL-" + trialStart;
    
    localStorage.setItem('smartpos_trial_start', trialStart.toString()); 
    localStorage.setItem('smartpos_shop_id', shopID);
    
    currentShopID = shopID; 
    shopName = "Guest Shop"; 
    waNumber = phone;
    
    localStorage.setItem(`pos_${shopID}_shopname`, shopName); 
    localStorage.setItem(`pos_${shopID}_wanumber`, waNumber);
    
    alert("✅ আপনার ১৫ দিনের ফ্রি ট্রায়াল শুরু হয়েছে!"); 
    checkSubscription(); // No reload
}

function activateLicense() {
    let keyInput = document.getElementById('license-key-input');
    if (!keyInput) return;
    
    let key = keyInput.value.trim().toUpperCase();
    if (!key) {
        alert("❌ License Key দিতে হবে!");
        return;
    }

    let adminPass = localStorage.getItem('smartpos_admin_pass') || "ADMIN-PRO-MAX";
    if (key === adminPass.toUpperCase()) {
        localStorage.setItem('is_super_admin', 'true');
        return openAdminPanel();
    }
    
    let btn = document.querySelector("button[onclick='activateLicense()']");
    if (btn) { 
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking...'; 
        btn.disabled = true; 
    }

    if (!navigator.onLine) {
        if (btn) { 
            btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Login'; 
            btn.disabled = false; 
        }
        alert("❌ ইন্টারনেট কানেকশন চেক করুন!");
        return;
    }

    db.collection("licenses").doc(key).get().then((doc) => {
        if (btn) { 
            btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Login'; 
            btn.disabled = false; 
        }
        
        if (doc.exists) {
            let licenseData = doc.data();
            let pass = prompt("🔑 এই লাইসেন্সের পাসওয়ার্ডটি দিন:");
            
            if (!pass) return;

            if (licenseData.password === pass) {
                let currentTime = Date.now();
                
                if (currentTime > licenseData.expiresAt) {
                    alert("⚠️ আপনার লাইসেন্সের মেয়াদ শেষ হয়ে গেছে! দয়া করে রিনিউ করুন।");
                } else if (licenseData.isActive === false) {
                    alert("🚫 আপনার লাইসেন্সটি অ্যাডমিন দ্বারা ব্লক করা হয়েছে!");
                } else {
                    localStorage.setItem('smartpos_shop_id', key);
                    alert("✅ লগইন সফল হয়েছে!");
                    checkSubscription(); // No reload
                }
            } else { 
                alert("❌ পাসওয়ার্ড ভুল হয়েছে!"); 
            }
        } else { 
            alert("❌ এই নামে কোনো License Key পাওয়া যায়নি!"); 
        }
    }).catch((error) => {
        if (btn) { 
            btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Login'; 
            btn.disabled = false; 
        }
        alert("❌ সার্ভারের সাথে কানেক্ট করা যাচ্ছে না!\nকারণ: " + error.message);
    });
}

function checkSubscription() {
    currentShopID = localStorage.getItem('smartpos_shop_id');
    
    if (!currentShopID || currentShopID === "null" || currentShopID === "undefined") {
        return showLoginPage();
    }

    let adminPass = localStorage.getItem('smartpos_admin_pass') || "ADMIN-PRO-MAX";
    
    if (currentShopID === adminPass.toUpperCase() || localStorage.getItem('is_super_admin') === 'true') {
        updateSubscriptionUI(null, false, true);
        loadDataAndSync(currentShopID); 
        showDashboard(); 
        return;
    }

    let isTrial = currentShopID.startsWith("TRIAL-");
    let now = Date.now();

    if (isTrial) {
        let trialStart = localStorage.getItem('smartpos_trial_start');
        if (!trialStart) {
            trialStart = now.toString();
            localStorage.setItem('smartpos_trial_start', trialStart);
        }
        
        let daysUsed = Math.floor((now - parseInt(trialStart)) / (1000 * 60 * 60 * 24));
        
        if (daysUsed <= 15) { 
            updateSubscriptionUI(null, true, false);
            loadDataAndSync(currentShopID); 
            showDashboard();
        } else { 
            alert("❌ আপনার ১৫ দিনের ফ্রি ট্রায়াল শেষ হয়ে গেছে! দয়া করে লাইসেন্স কিনুন।"); 
            forceLogout(); 
        }
    } else {
        if (!navigator.onLine) {
            updateSubscriptionUI({ validDays: 'Offline', expiresAt: Date.now() + 86400000, isActive: true }, false, false);
            loadDataAndSync(currentShopID); 
            showDashboard();
            return; 
        }
        
        if (db) {
            db.collection('licenses').doc(currentShopID).get().then(doc => {
                if (doc.exists) {
                    let data = doc.data();
                    
                    if (data.isActive === false) {
                        alert("❌ আপনার লাইসেন্সটি অ্যাডমিন প্যানেল থেকে সাসপেন্ড করা হয়েছে!"); 
                        forceLogout();
                    } else if (now > data.expiresAt) {
                        alert("⚠️ আপনার লাইসেন্সের মেয়াদ শেষ হয়ে গেছে! দয়া করে রিনিউ করুন।"); 
                        forceLogout();
                    } else {
                        updateSubscriptionUI(data, false, false);
                        loadDataAndSync(currentShopID); 
                        showDashboard();
                    }
                } else { 
                    alert("❌ আপনার লাইসেন্সটি ডাটাবেসে পাওয়া যায়নি!"); 
                    forceLogout(); 
                }
            }).catch(err => {
                updateSubscriptionUI({ validDays: 'Server Error', expiresAt: Date.now() + 86400000, isActive: true }, false, false);
                loadDataAndSync(currentShopID); 
                showDashboard();
            });
        }
    }
}

// 🔥 FIXED: LOGOUT FUNCTION
function forceLogout() { 
    localStorage.removeItem('smartpos_shop_id'); 
    localStorage.removeItem('smartpos_trial_start'); 
    currentShopID = null; 
    showLoginPage(); 
}

function logoutSystem() {
    if (confirm("আপনি কি নিশ্চিত যে লগআউট করতে চান?")) {
        localStorage.removeItem('smartpos_shop_id'); 
        localStorage.removeItem('is_super_admin'); 
        localStorage.removeItem('smartpos_trial_start'); 
        
        currentShopID = null;
        customersDB = []; 
        productsDB = []; 
        salesHistoryDB = []; 
        dueCollectionHistoryDB = [];
        expensesDB = []; 
        cartItems = [];
        
        let keyInput = document.getElementById('license-key-input');
        if(keyInput) keyInput.value = '';
        
        showLoginPage();
        alert("✅ সফলভাবে লগআউট হয়েছে!");
    }
}

function changeUserPassword() {
    let currentKey = localStorage.getItem('smartpos_shop_id');
    if (!currentKey) {
        return alert("❌ আপনি লগইন করা নেই!");
    }

    let oldPass = prompt("আপনার বর্তমান (Old) পাসওয়ার্ডটি লিখুন:");
    if (!oldPass) return;

    db.collection("licenses").doc(currentKey).get().then((doc) => {
        if (doc.exists && doc.data().password === oldPass) {
            let newPass = prompt("আপনার নতুন পাসওয়ার্ডটি লিখুন (কমপক্ষে ৬ অক্ষর):");
            
            if (newPass && newPass.length >= 6) {
                db.collection("licenses").doc(currentKey).update({
                    password: newPass
                }).then(() => {
                    alert("✅ পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে!");
                });
            } else {
                alert("❌ পাসওয়ার্ড অবশ্যই ৬ অক্ষর বা তার বেশি হতে হবে!");
            }
        } else {
            alert("❌ আপনার বর্তমান পাসওয়ার্ডটি ভুল হয়েছে!");
        }
    });
}

// ============================================================================
// PROFILE & SUBSCRIPTION UI
// ============================================================================
function updateSubscriptionUI(data, isTrial, isAdmin) {
    let typeElem = document.getElementById('profile-sub-type');
    let statusElem = document.getElementById('profile-sub-status');
    let expElem = document.getElementById('profile-sub-expiry');
    let badgeElem = document.getElementById('sub-status-badge');

    if (!typeElem) return;

    if (isAdmin) {
        typeElem.innerText = "Lifetime Master / Admin";
        statusElem.innerHTML = "<span style='color:#10b981;'>Active Always</span>";
        expElem.innerHTML = "<span style='color:#10b981;'>Unlimited</span>";
        if (badgeElem) badgeElem.innerHTML = '<i class="fa-solid fa-shield-halved" style="color:#10b981;"></i> Master Admin';
    } 
    else if (isTrial) {
        let start = parseInt(localStorage.getItem('smartpos_trial_start') || Date.now());
        let daysUsed = Math.floor((Date.now() - start) / (1000 * 60 * 60 * 24));
        let left = 15 - daysUsed;
        
        typeElem.innerText = "Free Trial (15 Days)";
        statusElem.innerHTML = "<span style='color:#f59e0b;'>Active (Guest)</span>";
        expElem.innerText = `${left} Days Left`;
        if (badgeElem) badgeElem.innerHTML = `<i class="fa-solid fa-clock"></i> Trial: ${left} Days`;
    } 
    else if (data) {
        typeElem.innerText = `Premium Pro (${data.validDays} Days)`;
        statusElem.innerHTML = data.isActive ? "<span style='color:#10b981;'>Active</span>" : "<span style='color:#ef4444;'>Suspended</span>";
        
        let expDate = new Date(data.expiresAt).toLocaleDateString('en-US');
        let daysLeft = Math.floor((data.expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
        
        expElem.innerText = `${expDate} (${daysLeft} Days Left)`;
        if (badgeElem) badgeElem.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#10b981;"></i> Pro Active`;
    }
}

function showSubscriptionPlans() {
    let modal = document.getElementById('subscriptionModal');
    if (modal) {
        modal.classList.remove('hidden');
        let list = document.getElementById('customer-plan-list');
        list.innerHTML = `
            <div style="background:#fff; border: 2px solid #3b82f6; padding: 20px; border-radius: 8px;">
                <h3 style="color:#1e3a8a; margin-bottom:10px;">Basic Plan (1 Month)</h3>
                <h2 style="color:#3b82f6; margin-bottom:15px;">৳500</h2>
                <ul style="text-align:left; font-size:13px; color:#334155; margin-bottom:15px; padding-left:20px;">
                    <li>Unlimited Products</li>
                    <li>Unlimited Bills</li>
                    <li>Cloud Backup</li>
                </ul>
                <button class="btn btn-primary" style="width:100%;" onclick="window.open('https://wa.me/8801621244970?text=আমি%20৫০০%20টাকার%20বেসিক%20প্ল্যান%20নিতে%20চাই', '_blank')">
                    <i class="fa-brands fa-whatsapp"></i> Buy Now
                </button>
            </div>
            <div style="background:#fff; border: 2px solid #10b981; padding: 20px; border-radius: 8px; position:relative;">
                <div style="position:absolute; top:-12px; right:10px; background:#ef4444; color:#fff; padding:2px 10px; border-radius:10px; font-size:12px; font-weight:bold;">Best Value</div>
                <h3 style="color:#064e3b; margin-bottom:10px;">Pro Plan (1 Year)</h3>
                <h2 style="color:#10b981; margin-bottom:15px;">৳5000</h2>
                <ul style="text-align:left; font-size:13px; color:#334155; margin-bottom:15px; padding-left:20px;">
                    <li>Everything in Basic</li>
                    <li>Premium Support</li>
                    <li>Free Updates</li>
                </ul>
                <button class="btn btn-success" style="width:100%;" onclick="window.open('https://wa.me/8801621244970?text=আমি%20৫০০০%20টাকার%20প্রো%20প্ল্যান%20নিতে%20চাই', '_blank')">
                    <i class="fa-brands fa-whatsapp"></i> Buy Now
                </button>
            </div>
        `;
    }
}

// ============================================================================
// DATA SYNC & CLOUD STORAGE
// ============================================================================
function loadDataAndSync(shopId) {
    if (!shopId) return;
    loadSettings(); 
    
    let localCus = localStorage.getItem(`pos_${shopId}_customers`); 
    if (localCus) customersDB = JSON.parse(localCus);
    
    let localProd = localStorage.getItem(`pos_${shopId}_products`); 
    if (localProd) productsDB = JSON.parse(localProd);
    
    let localSale = localStorage.getItem(`pos_${shopId}_sales`); 
    if (localSale) salesHistoryDB = JSON.parse(localSale);
    
    let localDue = localStorage.getItem(`pos_${shopId}_due_collections`); 
    if (localDue) dueCollectionHistoryDB = JSON.parse(localDue);
    
    let localExp = localStorage.getItem(`pos_${shopId}_expenses`); 
    if (localExp) expensesDB = JSON.parse(localExp);
    
    let isTrial = shopId.startsWith("TRIAL-");
    
    if (isTrial || !db || !navigator.onLine) { 
        finalizeUIRender(); 
        return; 
    }
    
    db.collection('shops').doc(shopId).get().then((doc) => {
        if (doc.exists) { 
            let data = doc.data(); 
            
            const fixDates = (arr) => { 
                if (!arr) return []; 
                return arr.map(item => { 
                    if (item.rawDate && item.rawDate.seconds) {
                        item.rawDate = item.rawDate.seconds * 1000;
                    } 
                    return item; 
                }); 
            };
            
            if (data.customers && data.customers.length >= customersDB.length) customersDB = data.customers; 
            if (data.products && data.products.length >= productsDB.length) productsDB = data.products; 
            if (data.sales && data.sales.length >= salesHistoryDB.length) salesHistoryDB = fixDates(data.sales); 
            if (data.due_collections && data.due_collections.length >= dueCollectionHistoryDB.length) dueCollectionHistoryDB = fixDates(data.due_collections); 
            if (data.expenses && data.expenses.length >= expensesDB.length) expensesDB = fixDates(data.expenses); 
            
            shopName = data.shopName || "My Shop"; 
            waNumber = data.waNumber || "";
            
            localStorage.setItem(`pos_${shopId}_shopname`, shopName);
            localStorage.setItem(`pos_${shopId}_wanumber`, waNumber);
            localStorage.setItem(`pos_${shopId}_user_name`, data.ownerName || "");
            localStorage.setItem(`pos_${shopId}_user_email`, data.email || "");
            
            if (data.profilePic && data.profilePic.startsWith('data:image')) { 
                localStorage.setItem(`pos_${shopId}_user_pic`, data.profilePic); 
            } 
            
            saveDataLocally(shopId); 
            finalizeUIRender();
        } else { 
            finalizeUIRender(); 
        }
    }).catch(() => finalizeUIRender());
}

function saveData() {
    if (!currentShopID) return;
    
    saveDataLocally(currentShopID);
    
    if (!currentShopID.startsWith("TRIAL-") && navigator.onLine && db) {
        db.collection('shops').doc(currentShopID).set({
            customers: customersDB, 
            products: productsDB, 
            sales: salesHistoryDB, 
            due_collections: dueCollectionHistoryDB, 
            expenses: expensesDB,
            shopName: shopName, 
            waNumber: waNumber, 
            lastSync: new Date().toLocaleString()
        }, { merge: true }).catch(e => console.log("Cloud save delayed"));
    }
}

function saveDataLocally(shopId) {
    try {
        localStorage.setItem(`pos_${shopId}_customers`, JSON.stringify(customersDB));
        localStorage.setItem(`pos_${shopId}_products`, JSON.stringify(productsDB));
        localStorage.setItem(`pos_${shopId}_sales`, JSON.stringify(salesHistoryDB));
        localStorage.setItem(`pos_${shopId}_due_collections`, JSON.stringify(dueCollectionHistoryDB));
        localStorage.setItem(`pos_${shopId}_expenses`, JSON.stringify(expensesDB));
    } catch (e) { 
        alert("মেমোরি ফুল! কিছু অপ্রয়োজনীয় ডাটা মুছুন।"); 
    }
}

function finalizeUIRender() {
    applyShopBranding(); 
    applyGlobalBranding(); 
    renderAllTables(); 
    populateDropdowns(); 
    renderSalesHistory(); 
    updateCostUI(); 
    initChart(); 
    switchDashboardView('daily'); 
    
    if (!document.querySelector('.page-section.active')) { 
        switchPage('dashboard'); 
    }
    
    if (document.getElementById('profile') && document.getElementById('profile').classList.contains('active')) { 
        loadUserProfileData(); 
    }
}

// ============================================================================
// MASTER ADMIN: DASHBOARD & USER MANAGEMENT
// ============================================================================
function checkAdminAccess() {
    let pass = prompt("🔒 Enter Master Admin Password:"); 
    let currentPass = localStorage.getItem('smartpos_admin_pass') || "ADMIN-PRO-MAX";
    
    if (pass === currentPass) {
        let skeleton = document.getElementById('skeleton-loader'); 
        if (skeleton) skeleton.style.display = 'none';
        
        localStorage.setItem('is_super_admin', 'true'); 
        document.querySelector('.pos-container').style.display = 'none';
        
        let adminPanel = document.getElementById('super-admin-panel'); 
        if (adminPanel) { 
            adminPanel.classList.remove('hidden'); 
            adminPanel.style.display = 'block'; 
        }
        
        loadMasterDatabase();
        alert("Welcome Boss! 🚀");
    } else if (pass) { 
        alert("❌ Wrong Password!"); 
    }
}

function openAdminPanel() {
    let skeleton = document.getElementById('skeleton-loader'); 
    if (skeleton) skeleton.style.display = 'none';
    
    localStorage.setItem('is_super_admin', 'true'); 
    document.getElementById('saas-landing').style.display = 'none';
    
    let adminPanel = document.getElementById('super-admin-panel'); 
    if (adminPanel) { 
        adminPanel.classList.remove('hidden'); 
        adminPanel.style.display = 'block'; 
    }
    
    loadMasterDatabase();
}

function logoutAdmin() {
    localStorage.removeItem('is_super_admin'); 
    
    let adminPanel = document.getElementById('super-admin-panel'); 
    if (adminPanel) { 
        adminPanel.classList.add('hidden'); 
        adminPanel.style.display = 'none'; 
    }
    
    document.querySelector('.pos-container').style.display = 'flex'; 
    checkSubscription();
}

function changeAdminPassword() {
    let currentPass = localStorage.getItem('smartpos_admin_pass') || "ADMIN-PRO-MAX";
    let oldPass = prompt("🔒 আপনার বর্তমান (Current) পাসওয়ার্ডটি দিন:");
    
    if (oldPass === currentPass) { 
        let newPass = prompt("🔑 নতুন (New) পাসওয়ার্ডটি লিখুন:");
        if (newPass && newPass.trim() !== "") { 
            localStorage.setItem('smartpos_admin_pass', newPass.trim()); 
            alert("✅ পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে!"); 
        } else { 
            alert("❌ পাসওয়ার্ড খালি রাখা যাবে না!"); 
        }
    } else if (oldPass !== null) { 
        alert("❌ বর্তমান পাসওয়ার্ডটি ভুল!"); 
    }
}

function switchAdminTab(event, tabId) {
    document.querySelectorAll('.admin-tab-content').forEach(content => {
        content.style.display = 'none';
    });
    
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.background = 'transparent';
        btn.style.color = '#38bdf8';
    });
    
    document.getElementById(tabId).style.display = 'block';
    event.currentTarget.classList.add('active');
    event.currentTarget.style.background = '#38bdf8';
    event.currentTarget.style.color = '#0f172a';
}

function loadMasterDatabase() {
    if (!db || !navigator.onLine) {
        let tbody = document.getElementById('master-shop-list');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">Offline Mode: Connect to internet to see User List</td></tr>';
        }
        return;
    }

    db.collection('licenses').get().then(snapshot => {
        let tbody = document.getElementById('master-shop-list');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        let total = 0;
        let pro = 0;
        let trial = 0;
        let now = Date.now();

        snapshot.forEach(doc => {
            let d = doc.data();
            total++;
            
            let isExpired = now > d.expiresAt;
            let status = d.isActive 
                ? (isExpired ? 'Expired' : (d.shopID.startsWith('TRIAL') ? 'Trial' : 'Active Pro')) 
                : 'Suspended';
                
            if (status === 'Active Pro') {
                pro++; 
            } else {
                trial++;
            }
            
            let bg = d.isActive && !isExpired ? '#1e293b' : 'rgba(239, 68, 68, 0.2)';
            let expDate = new Date(d.expiresAt).toLocaleDateString('en-US');
            let statusColor = d.isActive && !isExpired ? '#10b981' : '#ef4444';

            tbody.innerHTML += `
            <tr style="background: ${bg}; border-bottom: 1px solid #334155;">
                <td style="padding: 10px;">
                    <b style="color: #38bdf8; font-size: 16px;">${d.shopID}</b><br>
                    <small style="color: #cbd5e1;">Pass: <b>${d.password}</b></small>
                </td>
                <td style="padding: 10px; color: #cbd5e1;">${d.validDays} Days</td>
                <td style="padding: 10px;">
                    <b style="color: ${statusColor};">${status}</b><br>
                    <small style="color: #cbd5e1;">Exp: ${expDate}</small>
                </td>
                <td style="padding: 10px;">
                    <button class="btn btn-warning btn-small" onclick="toggleShopStatus('${doc.id}', ${d.isActive})" style="margin-right: 5px;">
                        ${d.isActive ? 'Suspend' : 'Activate'}
                    </button>
                    <button class="btn btn-danger btn-small" onclick="deleteAdminShop('${doc.id}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>`;
        });

        let statTotal = document.getElementById('admin-stat-total');
        if (statTotal) statTotal.innerText = total;
        
        let statPro = document.getElementById('admin-stat-pro');
        if (statPro) statPro.innerText = pro;
        
        let statTrial = document.getElementById('admin-stat-trial');
        if (statTrial) statTrial.innerText = trial;
        
    }).catch(err => console.log("Error loading user list:", err));
}

function toggleShopStatus(id, currentStatus) {
    if (confirm(`আপনি কি এই ইউজারের স্ট্যাটাস ${currentStatus ? 'Suspend' : 'Active'} করতে চান?`)) {
        db.collection('licenses').doc(id).update({ 
            isActive: !currentStatus 
        }).then(() => {
            loadMasterDatabase();
        });
    }
}

function deleteAdminShop(id) {
    if (confirm("⚠️ সাবধান! আপনি কি সত্যিই এই ইউজার ও লাইসেন্সটি ডিলিট করতে চান?")) {
        db.collection('licenses').doc(id).delete().then(() => {
            loadMasterDatabase(); 
        });
    }
}

function generateLicense() {
    let shopIdInput = document.getElementById('new-shop-id');
    let passInput = document.getElementById('new-shop-pass');
    let daysInput = document.getElementById('custom-days');

    let shopId = shopIdInput ? shopIdInput.value.toUpperCase().trim() : ""; 
    let pass = passInput ? passInput.value.trim() : ""; 
    let validity = daysInput ? parseInt(daysInput.value) : 30;
    
    if (!shopId) return alert("দয়া করে License Key (Shop ID) দিন!"); 
    if (!pass) return alert("দয়া করে একটি Password দিন!"); 
    if (!validity || validity <= 0) return alert("দয়া করে কত দিনের মেয়াদ হবে তা লিখুন!");
    
    let expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + validity);

    db.collection('licenses').doc(shopId).set({ 
        shopID: shopId, 
        password: pass,
        validDays: validity, 
        expiresAt: expiryDate.getTime(),
        isActive: true, 
        createdAt: Date.now() 
    }).then(() => { 
        alert(`Success! 🎉\n\nLicense Key: ${shopId}\nPassword: ${pass}\nValidity: ${validity} Days\n\nলাইসেন্স সফলভাবে তৈরি হয়েছে!`); 
        
        loadMasterDatabase();
        
        if (shopIdInput) shopIdInput.value = ''; 
        if (passInput) passInput.value = '123456'; 
        if (daysInput) daysInput.value = '30';
    }).catch(error => { 
        alert("❌ Error: " + error.message); 
    });
}

function createNewLicense() {
    let shopIdInput = document.getElementById('genKey');
    let passInput = document.getElementById('genPass');
    let daysInput = document.getElementById('genDays');

    let shopId = shopIdInput ? shopIdInput.value.toUpperCase().trim() : ""; 
    let pass = passInput ? passInput.value.trim() : ""; 
    let validity = daysInput ? parseInt(daysInput.value) : 30;
    
    if (!shopId || !pass || !validity) return alert("সব তথ্য দিন!");
    
    let expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + validity);

    db.collection('licenses').doc(shopId).set({ 
        shopID: shopId, 
        password: pass,
        validDays: validity, 
        expiresAt: expiryDate.getTime(),
        isActive: true, 
        createdAt: Date.now() 
    }).then(() => { 
        alert(`Success! 🎉\n\nLicense Key: ${shopId}\nPassword: ${pass}`); 
        document.getElementById('adminLicenseModal').classList.add('hidden');
        if (shopIdInput) shopIdInput.value = ''; 
    }).catch(error => { 
        alert("❌ Error: " + error.message); 
    });
}

function saveGlobalAppName() {
    let newName = document.getElementById('global-app-name-input').value.trim();
    if (newName) {
        localStorage.setItem('smartpos_app_name', newName);
        applyGlobalBranding();
        alert("✅ Global App Name Updated!");
    }
}


// ============================================================================
// RENDER TABLES (PRODUCTS & CUSTOMERS)
// ============================================================================
function renderAllTables() {
    const prodBody = document.getElementById('prod-list-body'); 
    let lowStockCount = 0; 
    let totalInventoryValue = 0; 

    if (prodBody) {
        let thead = prodBody.parentElement.querySelector('thead');
        if (thead) {
            thead.innerHTML = `
            <tr style="background: #000000; color: white;">
                <th style="color: white;">Image & Name</th>
                <th style="color: white;">Barcode</th>
                <th style="color: white;">Stock</th>
                <th style="color: white;">Buy Price</th>
                <th style="color: white;">Sell Price</th>
                <th style="color: white;">Profit</th>
                <th style="color: white;" class="no-print">Action</th>
            </tr>`;
        }

        let prodHtml = ''; 
        let sortedProducts = [...productsDB].sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true}));

        sortedProducts.forEach((p) => {
            if (p.stock <= 5) lowStockCount++;
            if (p.stock > 0) totalInventoryValue += (p.stock * p.buy); 

            let stockStatus = p.stock <= 0 
                ? '<span style="color:#ef4444; font-weight:bold;">Out of Stock</span>' 
                : (p.stock <= 5 
                    ? `<span style="color:#dc2626; font-weight:bold;">Low: ${p.stock} ${p.unit||'Pcs'}</span>` 
                    : `<span style="font-weight:bold; color:#000000;">${p.stock} ${p.unit||'Pcs'}</span>`);
            
            let imgSrc = (p.img && p.img.length > 50) 
                ? p.img 
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=000&color=fff`;
            
            let barcodeText = p.barcode 
                ? `<span style="font-family:monospace; font-weight:bold; color:#000000;"><i class="fa-solid fa-barcode"></i> ${p.barcode}</span>` 
                : `<span style="color:#000000; font-size:12px;">N/A</span>`;

            let profit = p.sell - p.buy;
            let profitColor = profit >= 0 ? '#059669' : '#dc2626'; 

            prodHtml += `
            <tr style="border-bottom: 1px solid #cbd5e1;">
                <td style="display: flex; align-items:center; gap:10px; color:#000000;">
                    <img src="${imgSrc}" style="width:40px; height:40px; border-radius:5px; object-fit:cover; border: 1px solid #000;">
                    <b>${p.name}</b>
                </td>
                <td>${barcodeText}</td>
                <td>
                    ${stockStatus} 
                    <button class="btn btn-success btn-small no-print" onclick="quickStockUpdate('${p.name}')" title="Add Stock" style="padding: 2px 6px; font-size: 11px; margin-left: 8px; border-radius: 4px;">+</button>
                </td>
                <td style="color:#000000;">
                    <b>৳ ${p.buy}</b>
                    <button class="btn btn-warning btn-small no-print" onclick="quickPriceUpdate('${p.name}')" title="Change Buy Price" style="padding: 2px 6px; font-size: 11px; margin-left: 8px; border-radius: 4px;"><i class="fa-solid fa-pen"></i></button>
                </td>
                <td style="color:#000000;">
                    <b>৳ ${p.sell}</b> 
                    <button class="btn btn-primary btn-small no-print" onclick="quickSellPriceUpdate('${p.name}')" title="Change Sell Price" style="padding: 2px 6px; font-size: 11px; margin-left: 8px; border-radius: 4px;"><i class="fa-solid fa-pen"></i></button>
                </td>
                <td style="background: #f8fafc;">
                    <b style="color:${profitColor};">৳ ${profit.toFixed(2)}</b>
                </td>
                <td class="no-print" style="display:flex; gap:5px; flex-wrap:wrap;">
                    <button class="btn btn-primary btn-small" onclick="editProduct('${p.name}')" title="Edit Details"><i class="fa-solid fa-pen-to-square"></i></button> 
                    <button class="btn btn-warning btn-small" onclick="printSingleBarcode('${p.name}')" title="Barcode"><i class="fa-solid fa-barcode"></i></button>
                    <button class="btn btn-danger btn-small" onclick="deleteProduct('${p.name}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`;
        });
        
        prodBody.innerHTML = prodHtml; 
        
        let statTotItems = document.getElementById('stat-total-items');
        if (statTotItems) statTotItems.innerText = productsDB.length;
        
        let statLowStock = document.getElementById('stat-low-stock');
        if (statLowStock) statLowStock.innerText = lowStockCount;
        
        let statTotValue = document.getElementById('stat-total-value');
        if (statTotValue) statTotValue.innerText = `৳ ${totalInventoryValue.toFixed(2)}`;
    }

    const cusBody = document.getElementById('cus-list-body');
    if (cusBody) {
        let cusHtml = ''; 
        let sortedCustomers = [...customersDB].sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true}));

        sortedCustomers.forEach((c) => {
            let catTag = c.category === 'VIP' 
                ? '<span style="background:#fef3c7; color:#d97706; padding:3px 8px; border-radius: 12px; font-size:10px; font-weight:bold;"> VIP</span>' 
                : '<span style="background:#f1f5f9; color:#000; padding:3px 8px; border-radius:12px; font-size:10px;">Normal</span>';
            
            let imgSrc = (c.img && c.img.length > 50) 
                ? c.img 
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=000&color=fff&rounded=true`;
            
            cusHtml += `
            <tr>
                <td onclick="viewCustomerLedger('${c.name}')" style="cursor:pointer; display: flex; align-items:center; gap:12px; color:#000000;">
                    <img src="${imgSrc}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border: 1px solid #000;">
                    <div>
                        <b>${c.name}</b><br>
                        <small style="color:#000; font-weight:bold;">${c.phone}</small>
                    </div>
                </td>
                <td>${catTag}</td>
                <td style="color:#dc2626; font-weight:bold;">৳ ${c.due.toFixed(2)}</td>
                <td class="no-print">
                    <button class="btn btn-success btn-small" onclick="sendDueWhatsApp('${c.phone}', '${c.name}', ${c.due})" title="WhatsApp"><i class="fa-brands fa-whatsapp"></i></button> 
                    <button class="btn btn-primary btn-small" onclick="editCustomer('${c.name}')"><i class="fa-solid fa-pencil"></i></button> 
                    <button class="btn btn-danger btn-small" onclick="deleteCustomer('${c.name}')"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`;
        });
        cusBody.innerHTML = cusHtml; 
    }

    if (typeof renderDueTable === "function") {
        renderDueTable();
    }
}

// ============================================================================
// INLINE QUICK UPDATES (Product Table)
// ============================================================================
function quickStockUpdate(name) {
    let p = productsDB.find(prod => prod.name === name); 
    if (!p) return;
    
    let addStockStr = prompt(`'${name}' এর বর্তমান স্টক: ${p.stock} ${p.unit||'Pcs'}\n\nনতুন কত পিস মাল যোগ করবেন?`);
    if (!addStockStr) return; 
    
    let addStock = parseFloat(addStockStr);
    if (!isNaN(addStock) && addStock > 0) { 
        p.stock += addStock; 
        saveData(); 
        renderAllTables(); 
        populateDropdowns(); 
    }
}

function quickPriceUpdate(name) {
    let p = productsDB.find(prod => prod.name === name); 
    if (!p) return;
    
    let newBuyStr = prompt(`'${name}' এর বর্তমান কেনা দাম: ৳${p.buy}\n\nনতুন কেনা দাম (Buy Price) কত?`, p.buy);
    if (!newBuyStr) return; 
    
    let newBuyPrice = parseFloat(newBuyStr);
    
    if (!isNaN(newBuyPrice) && newBuyPrice >= 0) {
        if (newBuyPrice > p.buy) { 
            p.priceTrend = 'up'; 
            p.trendDiff = newBuyPrice - p.buy; 
        } 
        else if (newBuyPrice < p.buy) { 
            p.priceTrend = 'down'; 
            p.trendDiff = p.buy - newBuyPrice; 
        } 
        else { 
            p.priceTrend = 'same'; 
            p.trendDiff = 0; 
        }
        p.buy = newBuyPrice; 
        saveData(); 
        renderAllTables(); 
        populateDropdowns(); 
        if (typeof renderFullAnalytics === "function") renderFullAnalytics();
    }
}

function quickSellPriceUpdate(name) {
    let p = productsDB.find(prod => prod.name === name); 
    if (!p) return;
    
    let newSellStr = prompt(`'${name}' এর বর্তমান বিক্রয়মূল্য: ৳${p.sell}\n\nনতুন বিক্রয়মূল্য (Sell Price) কত?`, p.sell);
    if (!newSellStr) return; 
    
    let newSellPrice = parseFloat(newSellStr);
    if (!isNaN(newSellPrice) && newSellPrice >= 0) { 
        p.sell = newSellPrice; 
        saveData(); 
        renderAllTables(); 
        populateDropdowns(); 
    }
}

// ============================================================================
// DROPDOWNS & AUTOCOMPLETE
// ============================================================================
function populateDropdowns() {
    const cusList = document.getElementById('cus-dropdown-list'); 
    if (cusList) { 
        let cusHtml = `
            <div onclick="openCustomerModal()" style="padding:10px; background:#000000; color:#ffffff; font-weight:bold; text-align:center; cursor:pointer;">
                <i class="fa-solid fa-user-plus"></i> + Add New Customer
            </div>`; 
            
        let sortedCustomers = [...customersDB].sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true}));
        
        sortedCustomers.forEach(c => { 
            let imgSrc = (c.img && c.img.length > 50) 
                ? c.img 
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=000&color=fff&rounded=true`;
            
            cusHtml += `
            <div class="item" onclick="selectCustomer('${c.name}', ${c.due})" style="padding:10px; border-bottom:1px solid #eee; cursor:pointer; display:flex; align-items:center; gap:10px; color:#000;">
                <img src="${imgSrc}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:1px solid #000;">
                <div style="flex:1;">
                    <b style="font-size:15px; color:#000; display:block;">${c.name}</b>
                    <small style="color:#222; font-weight:bold;">Phone: ${c.phone} | Due: ৳${c.due.toFixed(2)}</small>
                </div>
            </div>`; 
        }); 
        cusList.innerHTML = cusHtml; 
    }

    const prodList = document.getElementById('prod-dropdown-list'); 
    if (prodList) { 
        let prodHtml = ''; 
        let sortedProducts = [...productsDB].sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true}));

        sortedProducts.forEach(p => { 
            let imgSrc = (p.img && p.img.length > 50) 
                ? p.img 
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=000&color=fff`;
            
            let barcodeDisplay = p.barcode ? ` | <i class="fa-solid fa-barcode"></i> ${p.barcode}` : '';
            
            prodHtml += `
            <div class="item" onclick="selectProduct('${p.name}', ${p.sell}, ${p.buy})" style="padding:12px; border-bottom:1px solid #eee; cursor:pointer; display:flex; align-items:center; gap:12px; color:#000;">
                <img src="${imgSrc}" style="width:45px; height:45px; border-radius:6px; object-fit:cover; border:1px solid #000;">
                <div style="flex:1;">
                    <b style="font-size:16px; color:#000; display:block;">${p.name}</b>
                    <small style="color:#000; font-weight:bold;">Stock: ${p.stock} ${p.unit||'Pcs'}${barcodeDisplay}</small>
                </div>
                <div style="font-size:16px; font-weight:bold; color:#000;">৳${p.sell}</div>
            </div>`; 
        }); 
        prodList.innerHTML = prodHtml; 
    }

    const salesFilter = document.getElementById('sales-customer-filter');
    if (salesFilter) {
        let currentVal = salesFilter.value; 
        let sfHtml = '<option value="All">All Customers</option>';
        
        let uniqueCustomers = [...new Set(salesHistoryDB.map(item => item.customer))];
        uniqueCustomers.sort((a,b) => a.localeCompare(b, undefined, {numeric: true})).forEach(name => { 
            if (name && name !== "Walk-in") {
                sfHtml += `<option value="${name}">${name}</option>`; 
            }
        });
        
        sfHtml += `<option value="Walk-in">Walk-in</option>`;
        salesFilter.innerHTML = sfHtml; 
        salesFilter.value = currentVal || "All";
    }
}

function toggleDropdown(id) { 
    document.getElementById(id).classList.toggle('hidden'); 
}

function filterDropdown(inputId, listId) { 
    const filter = document.getElementById(inputId).value.toUpperCase(); 
    const div = document.getElementById(listId); 
    if (!div) return; 
    
    const items = div.getElementsByClassName('item'); 
    div.classList.remove('hidden'); 
    
    for (let i = 0; i < items.length; i++) { 
        let txt = items[i].innerText.toUpperCase(); 
        items[i].style.display = txt.indexOf(filter) > -1 ? "flex" : "none"; 
    } 
}

// ============================================================================
// CRUD OPERATIONS (MODALS & LOGIC)
// ============================================================================

// --- Customer CRUD ---
function openCustomerModal() { 
    document.getElementById('editCusIndex').value = "-1"; 
    document.getElementById('cus-modal-title').innerText = "Add New Customer"; 
    document.getElementById('newCusName').value = ''; 
    document.getElementById('newCusPhone').value = ''; 
    document.getElementById('newCusDue').value = '0'; 
    document.getElementById('cus-img-preview').src = "https://via.placeholder.com/80?text=User"; 
    document.getElementById('addCustomerModal').classList.remove('hidden'); 
}

function editCustomer(name) { 
    let c = customersDB.find(cus => cus.name === name); 
    if (!c) return; 
    
    document.getElementById('editCusIndex').value = name; 
    document.getElementById('cus-modal-title').innerText = "Edit: " + name; 
    document.getElementById('newCusName').value = c.name; 
    document.getElementById('newCusPhone').value = c.phone; 
    document.getElementById('newCusDue').value = c.due; 
    document.getElementById('cus-img-preview').src = c.img && c.img.length > 50 ? c.img : "https://via.placeholder.com/80?text=User"; 
    document.getElementById('addCustomerModal').classList.remove('hidden'); 
}

function saveNewCustomer() { 
    const name = document.getElementById('newCusName').value.trim(); 
    const phone = document.getElementById('newCusPhone').value.trim(); 
    const due = parseFloat(document.getElementById('newCusDue').value) || 0; 
    
    let imgData = document.getElementById('cus-img-preview').src; 
    if (imgData.includes('via.placeholder.com')) {
        imgData = ""; 
    }
    
    if (!name || !phone) {
        return alert("নাম ও ফোন দিন!"); 
    }
    
    let editIdx = document.getElementById('editCusIndex').value; 
    
    if (editIdx !== "-1") { 
        let c = customersDB.find(cus => cus.name === editIdx); 
        if (c) { 
            c.name = name; 
            c.phone = phone; 
            c.due = due; 
            c.img = imgData; 
        } 
    } else { 
        if (customersDB.find(c => c.name.toLowerCase() === name.toLowerCase())) {
            return alert("এই নামে অলরেডি কাস্টমার আছে!"); 
        }
        customersDB.push({ name, phone, category: "Normal", due, limit: 5000, img: imgData }); 
    } 
    
    saveData(); 
    document.getElementById('addCustomerModal').classList.add('hidden'); 
    renderAllTables(); 
    populateDropdowns(); 
}

function deleteCustomer(name) { 
    if (confirm("কাস্টমার ডিলিট করবেন?")) { 
        customersDB = customersDB.filter(c => c.name !== name); 
        saveData(); 
        renderAllTables(); 
        populateDropdowns(); 
    } 
}

// --- Product CRUD ---
function openProductModal() { 
    document.getElementById('editProdIndex').value = "-1"; 
    document.getElementById('product-modal-title').innerHTML = '<i class="fa-solid fa-box-open"></i> Add Product'; 
    document.getElementById('newProdName').value = ''; 
    if (document.getElementById('newProdBarcode')) document.getElementById('newProdBarcode').value = ''; 
    document.getElementById('newBuyPrice').value = ''; 
    document.getElementById('newSellPrice').value = ''; 
    document.getElementById('newStock').value = ''; 
    document.getElementById('img-preview').src = "https://via.placeholder.com/100?text=Upload"; 
    document.getElementById('addProductModal').classList.remove('hidden'); 
}

function editProduct(name) { 
    let p = productsDB.find(prod => prod.name === name); 
    if (!p) return; 
    
    document.getElementById('editProdIndex').value = name; 
    document.getElementById('newProdName').value = p.name; 
    if (document.getElementById('newProdBarcode')) document.getElementById('newProdBarcode').value = p.barcode || ''; 
    document.getElementById('newBuyPrice').value = p.buy; 
    document.getElementById('newSellPrice').value = p.sell; 
    document.getElementById('newStock').value = p.stock; 
    document.getElementById('img-preview').src = p.img && p.img.length > 50 ? p.img : "https://via.placeholder.com/100?text=Upload"; 
    document.getElementById('addProductModal').classList.remove('hidden'); 
}

function saveNewProduct() { 
    const name = document.getElementById('newProdName').value.trim(); 
    const barcodeElem = document.getElementById('newProdBarcode');
    const barcode = barcodeElem ? barcodeElem.value.trim() : ''; 
    const buy = parseFloat(document.getElementById('newBuyPrice').value) || 0; 
    const sell = parseFloat(document.getElementById('newSellPrice').value) || 0; 
    const stock = parseFloat(document.getElementById('newStock').value); 
    
    let imgData = document.getElementById('img-preview').src; 
    if (imgData.includes('via.placeholder.com')) {
        imgData = ""; 
    }
    
    if (!name || isNaN(stock) || isNaN(sell)) {
        return alert("সব তথ্য দিন!"); 
    }
    
    let editNameRef = document.getElementById('editProdIndex').value; 
    
    if (editNameRef !== "-1") { 
        let p = productsDB.find(prod => prod.name === editNameRef); 
        if (p) { 
            p.name = name; 
            p.barcode = barcode; 
            p.buy = buy; 
            p.sell = sell; 
            p.stock = stock; 
            p.img = imgData; 
        } 
    } else { 
        productsDB.push({ name, barcode, stock, buy, sell, unit: 'Pcs', img: imgData, isTop: false }); 
    } 
    
    saveData(); 
    document.getElementById('addProductModal').classList.add('hidden'); 
    renderAllTables(); 
    populateDropdowns(); 
}

function deleteProduct(name) { 
    if (confirm("প্রোডাক্ট ডিলিট করবেন?")) { 
        productsDB = productsDB.filter(p => p.name !== name); 
        saveData(); 
        renderAllTables(); 
        populateDropdowns(); 
    } 
}

// --- Table Filters ---
function filterCustomerTable() { 
    let f = document.getElementById('cus-search-page').value.toUpperCase(); 
    document.querySelectorAll('#cus-list-body tr').forEach(r => { 
        r.style.display = r.innerText.toUpperCase().indexOf(f) > -1 ? "" : "none"; 
    }); 
}

function searchProductTable() { 
    let f = document.getElementById('prod-search-input').value.toUpperCase(); 
    document.querySelectorAll('#prod-list-body tr').forEach(r => { 
        r.style.display = r.innerText.toUpperCase().indexOf(f) > -1 ? "" : "none"; 
    }); 
}

function filterLowStock() { 
    document.querySelectorAll('#prod-list-body tr').forEach(r => { 
        if (!r.innerHTML.includes('Low:') && !r.innerHTML.includes('Out of Stock')) {
            r.style.display = 'none'; 
        } else {
            r.style.display = ''; 
        }
    }); 
}

// --- Image Handling (High Quality Compression) ---
function compressAndPreview(event, imgElementId) { 
    const file = event.target.files[0]; 
    if (!file) return; 
    
    const reader = new FileReader(); 
    reader.onload = function(e) { 
        const img = new Image(); 
        img.onload = function() { 
            const canvas = document.createElement('canvas'); 
            const maxSize = 300; 
            let width = img.width; 
            let height = img.height; 
            
            if (width > height) { 
                if (width > maxSize) { height *= maxSize / width; width = maxSize; } 
            } else { 
                if (height > maxSize) { width *= maxSize / height; height = maxSize; } 
            } 
            
            canvas.width = width; 
            canvas.height = height; 
            const ctx = canvas.getContext('2d'); 
            ctx.drawImage(img, 0, 0, width, height); 
            document.getElementById(imgElementId).src = canvas.toDataURL('image/jpeg', 0.8); 
        }; 
        img.src = e.target.result; 
    }; 
    reader.readAsDataURL(file); 
}

function previewImage(event) { 
    compressAndPreview(event, 'img-preview'); 
}
function previewCusImage(event) { 
    compressAndPreview(event, 'cus-img-preview'); 
}
function previewUserProfileImage(event) { 
    compressAndPreview(event, 'display-profile-img'); 
}

function sendDueWhatsApp(phone, name, due) {
    if (!phone || phone === "N/A") {
        return alert("ফোন নম্বর নেই!");
    }
    let msg = `আসসালামু আলাইকুম ${name} ভাই,\nআপনার বকেয়া বিলের পরিমাণ: ৳${due.toFixed(2)}। দয়া করে বিলটি পরিশোধ করার অনুরোধ করা হলো।\n\nধন্যবাদ,\n${shopName}`;
    window.open(`https://wa.me/${phone.startsWith('0') ? '88'+phone : phone}?text=${encodeURIComponent(msg)}`, '_blank');
}

// ============================================================================
// BILLING / CART OPERATIONS
// ============================================================================
function handleBarcodeScan(event) {
    filterDropdown('billing-product-search', 'prod-dropdown-list');
    
    if (event.key === 'Enter') {
        let searchBox = document.getElementById('billing-product-search'); 
        let searchVal = searchBox.value.toLowerCase().trim();
        
        let product = productsDB.find(p => (p.barcode && p.barcode.toLowerCase() === searchVal) || p.name.toLowerCase() === searchVal);
        
        if (product) { 
            selectProduct(product.name, product.sell, product.buy); 
            searchBox.value = ''; 
            document.getElementById('prod-dropdown-list').classList.add('hidden'); 
            searchBox.focus(); 
        } else { 
            alert("❌ প্রোডাক্ট পাওয়া যায়নি!"); 
            searchBox.value = ''; 
            searchBox.focus(); 
        }
    }
}

function selectCustomer(name, dueAmt) { 
    document.getElementById('cus-search-billing').value = name; 
    document.getElementById('cus-dropdown-list').classList.add('hidden'); 
    currentCustomerDue = dueAmt || 0; 
    document.getElementById('bill-prev-due').innerText = `৳ ${currentCustomerDue.toFixed(2)}`; 
    calculateCartTotal(); 
}

function walkIn() { 
    document.getElementById('cus-search-billing').value = "Walk-in"; 
    document.getElementById('cus-dropdown-list').classList.add('hidden'); 
    currentCustomerDue = 0; 
    document.getElementById('bill-prev-due').innerText = `৳ 0`; 
    calculateCartTotal(); 
}

function selectProduct(name, price, buyPrice) { 
    document.getElementById('billing-product-search').value = ""; 
    document.getElementById('prod-dropdown-list').classList.add('hidden'); 
    addToCart(name, 1, price, buyPrice); 
}

function addToCart(name, qty, price, buyPrice) { 
    let existing = cartItems.find(i => i.name === name); 
    
    if (existing) { 
        existing.qty += parseFloat(qty); 
    } else { 
        if (buyPrice === undefined) { 
            let p = productsDB.find(prod => prod.name === name); 
            buyPrice = p ? p.buy : 0; 
        } 
        cartItems.push({ name, qty: parseFloat(qty), price, buyPrice }); 
    } 
    renderCart(); 
}

function renderCart() {
    const body = document.getElementById('cart-items'); 
    if (!body) return; 
    
    body.innerHTML = ''; 
    let subtotal = 0;
    
    if (cartItems.length === 0) { 
        body.innerHTML = `
        <tr>
            <td colspan="5" style="text-align:center; color:#000; font-weight:bold; padding:20px;">
                কোনো প্রোডাক্ট যোগ করা হয়নি
            </td>
        </tr>`; 
    } else {
        cartItems.forEach((item, i) => { 
            let total = item.qty * item.price; 
            subtotal += total; 
            
            body.innerHTML += `
            <tr style="border-bottom:1px solid #cbd5e1;">
                <td style="font-weight:bold; color:#000000; font-size:15px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:150px;" title="${item.name}">${item.name}</td>
                <td>
                    <input type="number" value="${item.qty}" style="width:100px; height: 38px; font-size: 16px; text-align:center; padding:6px; margin:0; font-weight:bold; border:2px solid #000; border-radius:6px; background: #fff; color: #000;" onchange="updateQty(${i}, this.value)">
                </td>
                <td>
                    <input type="number" value="${item.price}" style="width:80px; height: 38px; padding:6px; margin:0; border:2px solid #000; border-radius:6px; color:#000; font-weight:bold;" onchange="updateCartPrice(${i}, this.value)">
                </td>
                <td style="font-weight:bold; color:#000; font-size: 15px;">৳${total.toFixed(2)}</td>
                <td>
                    <button class="btn btn-danger btn-small" onclick="removeFromCart(${i})"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`; 
        }); 
    }
    
    cartTotal = subtotal; 
    calculateCartTotal();
}

function updateQty(i, val) { 
    let qty = parseFloat(val); 
    if (qty <= 0 || isNaN(qty)) {
        qty = 1; 
    }
    cartItems[i].qty = qty; 
    renderCart(); 
}

function updateCartPrice(i, val) { 
    let p = parseFloat(val); 
    if (p < 0 || isNaN(p)) {
        p = 0; 
    }
    cartItems[i].price = p; 
    renderCart(); 
}

function removeFromCart(i) { 
    cartItems.splice(i, 1); 
    renderCart(); 
}

function calculateCartTotal() {
    document.getElementById('bill-subtotal').innerText = `৳ ${cartTotal.toFixed(2)}`; 
    
    let chk = document.getElementById('chk-prev-due'); 
    let prevDueToAdd = (chk && chk.checked) ? currentCustomerDue : 0; 
    
    let discInput = document.getElementById('bill-discount'); 
    let discount = parseFloat(discInput ? discInput.value : 0) || 0;
    
    let grandTotal = Math.max(0, (cartTotal + prevDueToAdd) - discount); 
    document.getElementById('bill-grand-total').innerText = `Total: ৳ ${grandTotal.toFixed(2)}`;
    
    let paidInput = document.getElementById('bill-paid'); 
    if (paidInput) {
        paidInput.value = grandTotal > 0 ? grandTotal.toFixed(2) : ''; 
    }
    
    updateDueCalculation(grandTotal);
}

function updateDueCalculation(gTotal) { 
    let grandTotal = gTotal !== undefined 
        ? gTotal 
        : parseFloat(document.getElementById('bill-grand-total').innerText.replace('Total: ৳ ', '')) || 0; 
        
    let paidInputElem = document.getElementById('bill-paid');
    const paidAmt = parseFloat(paidInputElem ? paidInputElem.value : 0) || 0; 
    
    let dueAmt = document.getElementById('bill-due-amount'); 
    if (dueAmt) {
        dueAmt.value = Math.max(0, grandTotal - paidAmt).toFixed(2); 
    }
}

function clearCart() { 
    if (confirm("কার্ট মুছবেন?")) { 
        cartItems = []; 
        renderCart(); 
        walkIn(); 
    } 
}

function holdInvoice() { 
    if (cartItems.length === 0) return; 
    
    let cusName = document.getElementById('cus-search-billing').value || "Walk-in"; 
    holdInvoices.push({ id: Date.now(), customer: cusName, items: [...cartItems] }); 
    
    cartItems = []; 
    renderCart(); 
    alert("Hold Successful!"); 
    walkIn(); 
}

function showHoldList() { 
    if (holdInvoices.length === 0) {
        return alert("কোনো বিল নেই!"); 
    }
    
    let listStr = holdInvoices.map((inv, i) => `${i+1}. ${inv.customer}`).join('\n'); 
    let choice = prompt(`হোল্ড বিল:\n${listStr}\nনম্বর লিখুন:`); 
    
    if (choice && holdInvoices[choice-1]) { 
        cartItems = holdInvoices[choice-1].items; 
        document.getElementById('cus-search-billing').value = holdInvoices[choice-1].customer; 
        holdInvoices.splice(choice-1, 1); 
        renderCart(); 
    } 
}

function finalizeSale(action) {
    if (cartItems.length === 0) {
        return alert("কার্ট খালি! কোনো প্রোডাক্ট সিলেক্ট করুন।");
    }
    
    let grandTotal = parseFloat(document.getElementById('bill-grand-total').innerText.replace('Total: ৳ ', '')) || 0; 
    let paidAmt = parseFloat(document.getElementById('bill-paid').value) || 0; 
    let currentDue = parseFloat(document.getElementById('bill-due-amount').value) || 0; 
    let cusName = document.getElementById('cus-search-billing').value.trim() || "Walk-in";
    
    let invoiceNo = "INV-" + Math.floor(Math.random() * 90000 + 10000); 
    let dateObj = new Date(); 
    let date = dateObj.toLocaleString('en-US');
    
    let chk = document.getElementById('chk-prev-due'); 
    let pDue = (chk && chk.checked) ? currentCustomerDue : 0;
    
    let discInput = document.getElementById('bill-discount'); 
    let discount = parseFloat(discInput ? discInput.value : 0) || 0;
    
    let customerObj = customersDB.find(c => c.name.toLowerCase() === cusName.toLowerCase()); 
    if (!customerObj && cusName.toLowerCase() !== "walk-in") { 
        customersDB.push({ name: cusName, phone: "N/A", category: "Normal", due: 0, limit: 5000, img: "" }); 
        customerObj = customersDB[customersDB.length - 1]; 
    }
    
    let printItemsHtml = `<table style="width:100%; border-collapse: collapse; margin: 15px 0; font-size: 13px; text-align: left;"><tr style="border-bottom: 2px solid #000; color:#000;"><th style="padding:5px 0; background:transparent;">বিবরণ</th><th style="background:transparent;">পরিমাণ</th><th style="text-align:right; background:transparent;">মোট (৳)</th></tr>`;
    let waItemsText = ``;
    
    cartItems.forEach(item => {
        let itemTotal = item.qty * item.price;
        printItemsHtml += `<tr style="border-bottom: 1px dotted #000; color:#000;"><td style="padding:5px 0;">${item.name}<br><small>@৳${item.price}</small></td><td>${item.qty}</td><td style="text-align:right;">${itemTotal.toFixed(2)}</td></tr>`;
        waItemsText += `▪ ${item.name} (${item.qty} x ${item.price}) = ৳${itemTotal.toFixed(2)}\n`;
    });
    printItemsHtml += `</table>`;
    
    let waMessage = `*${shopName}*\n📅 ${dateObj.toLocaleDateString()}\n🧾 Inv: ${invoiceNo}\n👤 Customer: ${cusName}\n\n*-- আইটেমসমূহ --*\n${waItemsText}\n*Subtotal:* ৳${cartTotal.toFixed(2)}\n`;
    
    if (pDue > 0) {
        waMessage += `*Prev. Due:* ৳${pDue.toFixed(2)}\n`;
    }
    if (discount > 0) {
        waMessage += `*Discount:* -৳${discount.toFixed(2)}\n`;
    }
    
    waMessage += `-------------------\n*Grand Total: ৳${grandTotal.toFixed(2)}*\n*Paid:* ৳${paidAmt.toFixed(2)}\n*Current Due:* ৳${currentDue.toFixed(2)}\n\nধন্যবাদ! আবার আসবেন।`;

    let totalBuyCost = 0; 
    let savedItems = JSON.parse(JSON.stringify(cartItems)); 
    
    cartItems.forEach(i => { 
        let p = productsDB.find(prod => prod.name === i.name); 
        if (p) {
            p.stock -= i.qty; 
        }
        totalBuyCost += (i.qty * (i.buyPrice || 0)); 
    });
    
    let invoiceProfit = grandTotal - totalBuyCost;

    salesHistoryDB.unshift({ 
        invoice: invoiceNo, 
        date: date, 
        rawDate: dateObj.getTime(), 
        customer: cusName, 
        total: grandTotal, 
        paid: paidAmt, 
        due: currentDue, 
        profit: invoiceProfit, 
        items: savedItems, 
        pDue: pDue, 
        discount: discount 
    });
    
    if (customerObj) { 
        customerObj.due = (customerObj.due - pDue) + currentDue; 
        if (customerObj.due < 0) {
            customerObj.due = 0; 
        }
    }
    
    saveData(); 

    if (action === 'print') { 
        let pDueHtml = pDue > 0 ? `<p style="margin:2px 0;">Prev. Due: ৳${pDue.toFixed(2)}</p>` : ``;
        let discountHtml = discount > 0 ? `<p style="margin:2px 0;">Discount: -৳${discount.toFixed(2)}</p>` : ``;
        
        let finalInvoiceHTML = `
        <div style="font-family: 'Hind Siliguri', sans-serif; color: #000; max-width: 300px; margin: 0 auto; padding: 10px;">
            <h2 style="text-align:center; margin-bottom: 5px; color: #000; font-size: 22px;">${shopName}</h2>
            <div style="text-align:center; font-size:12px; margin-bottom: 15px; color:#000;">মোবাইল: ${waNumber || "N/A"}</div>
            <div style="font-size:13px; border-bottom:1px solid #000; padding-bottom:5px; margin-bottom: 5px; color:#000;">
                <b>Inv No:</b> ${invoiceNo}<br>
                <b>Date:</b> ${dateObj.toLocaleString('en-US', {hour12:true})}<br>
                <b>Customer:</b> ${cusName}
            </div>
            ${printItemsHtml}
            <div style="text-align:right; font-size:14px; margin-top: 10px; color:#000;">
                <p style="margin:2px 0;">Subtotal: ৳${cartTotal.toFixed(2)}</p>
                ${pDueHtml}
                ${discountHtml}
                <h3 style="border-top:1px solid #000; padding-top:5px; margin-top:5px; font-size: 16px;">Total: ৳${grandTotal.toFixed(2)}</h3>
                <p style="margin:2px 0;">Paid: ৳${paidAmt.toFixed(2)}</p>
                <p style="margin:2px 0; font-weight:bold;">Due: ৳${currentDue.toFixed(2)}</p>
            </div>
            <div style="text-align:center; margin-top:20px; font-size:12px; border-top: 1px dashed #000; padding-top: 10px; color:#000;">
                *** বিক্রিত মাল ফেরত নেওয়া হয় না ***<br>ধন্যবাদ, আবার আসবেন!
            </div>
        </div>`; 
        
        printHTML(finalInvoiceHTML); 
        setTimeout(resetBillingPage, 1000); 
    } else if (action === 'whatsapp') { 
        let phone = customerObj ? customerObj.phone : ""; 
        if (!phone || phone === "N/A") {
            alert("কাস্টমারের নম্বর নেই! শুধু সিস্টেমে সেভ করা হচ্ছে।"); 
        } else {
            window.open(`https://wa.me/${phone.startsWith('0') ? '88' + phone : phone}?text=${encodeURIComponent(waMessage)}`, '_blank'); 
        }
        resetBillingPage();
    } else { 
        alert(`✅ বিল সফলভাবে সেভ হয়েছে!`); 
        resetBillingPage(); 
    }
}

function resetBillingPage() { 
    renderAllTables(); 
    populateDropdowns(); 
    renderSalesHistory(); 
    cartItems = []; 
    renderCart(); 
    walkIn(); 
}

// ============================================================================
// SALES HISTORY & INVOICE MANAGEMENT
// ============================================================================
function viewInvoice(invNo) {
    let sale = salesHistoryDB.find(s => s.invoice === invNo); 
    if (!sale) return alert("Invoice not found!");
    
    let printItemsHtml = `<table style="width:100%; border-collapse: collapse; margin: 15px 0; font-size: 13px; text-align: left;"><tr style="border-bottom: 2px solid #000; color:#000;"><th style="padding:5px 0;">বিবরণ</th><th>পরিমাণ</th><th style="text-align:right;">মোট (৳)</th></tr>`; 
    let cartSubTotal = 0;
    
    if (sale.items && sale.items.length > 0) { 
        sale.items.forEach(item => { 
            let itemTotal = item.qty * item.price; 
            cartSubTotal += itemTotal; 
            printItemsHtml += `<tr style="border-bottom: 1px dotted #000; color:#000;"><td style="padding:5px 0;">${item.name}<br><small>@৳${item.price}</small></td><td>${item.qty}</td><td style="text-align:right;">${itemTotal.toFixed(2)}</td></tr>`; 
        }); 
    } else { 
        printItemsHtml += `<tr><td colspan="3" style="text-align:center; padding:10px; color:#000;">পুরানো বিলের আইটেম ডিটেইলস সেভ করা নেই।</td></tr>`; 
        cartSubTotal = sale.total; 
    }
    
    printItemsHtml += `</table>`; 
    let pDue = sale.pDue || 0; 
    let discount = sale.discount || 0;

    let pDueHtml = pDue > 0 ? `<p style="margin:2px 0;">Prev. Due: ৳${pDue.toFixed(2)}</p>` : ``;
    let discountHtml = discount > 0 ? `<p style="margin:2px 0;">Discount: -৳${discount.toFixed(2)}</p>` : ``;

    document.getElementById('reprint-invoice-area').innerHTML = `
    <div style="font-family: 'Hind Siliguri', sans-serif; color: #000; padding: 10px; max-width: 300px; margin: 0 auto;">
        <h2 style="text-align:center; margin-bottom: 5px; color: #000; font-size: 22px;">${shopName}</h2>
        <div style="text-align:center; font-size:12px; margin-bottom: 15px; color:#000;">মোবাইল: ${waNumber || "N/A"}</div>
        <div style="font-size:13px; border-bottom:1px solid #000; padding-bottom:5px; margin-bottom: 5px; color:#000;">
            <b>Inv No:</b> ${sale.invoice}<br>
            <b>Date:</b> ${sale.date.split(',')[0]}<br>
            <b>Customer:</b> ${sale.customer}
        </div>
        ${printItemsHtml}
        <div style="text-align:right; font-size:14px; margin-top: 10px; color:#000;">
            <p style="margin:2px 0;">Subtotal: ৳${cartSubTotal.toFixed(2)}</p>
            ${pDueHtml}
            ${discountHtml}
            <h3 style="border-top:1px solid #000; padding-top:5px; margin-top:5px; font-size: 16px;">Total: ৳${sale.total.toFixed(2)}</h3>
            <p style="margin:2px 0;">Paid: ৳${sale.paid.toFixed(2)}</p>
            <p style="margin:2px 0; font-weight:bold;">Due: ৳${sale.due.toFixed(2)}</p>
        </div>
        <div style="text-align:center; margin-top:20px; font-size:12px; border-top: 1px dashed #000; padding-top: 10px; color:#000;">
            *** বিক্রিত মাল ফেরত নেওয়া হয় না ***<br>ধন্যবাদ, আবার আসবেন!
        </div>
    </div>`;
    
    document.getElementById('invoiceModal').classList.remove('hidden');
}

function deleteInvoice(invNo) {
    if (!confirm("আপনি কি নিশ্চিত এই ইনভয়েসটি মুছে ফেলতে চান? \nস্টক এবং কাস্টমারের বাকি অটোমেটিক ঠিক হয়ে যাবে!")) {
        return;
    }
    
    let saleIdx = salesHistoryDB.findIndex(s => s.invoice === invNo); 
    if (saleIdx === -1) return; 
    
    let sale = salesHistoryDB[saleIdx];
    
    if (sale.items) { 
        sale.items.forEach(item => { 
            let p = productsDB.find(prod => prod.name === item.name); 
            if (p) p.stock += item.qty; 
        }); 
    }
    
    if (sale.due > 0 && sale.customer !== "Walk-in") { 
        let c = customersDB.find(cus => cus.name === sale.customer); 
        if (c) { 
            c.due -= sale.due; 
            if (c.due < 0) c.due = 0; 
        } 
    }
    
    salesHistoryDB.splice(saleIdx, 1); 
    saveData(); 
    renderAllTables(); 
    renderSalesHistory(); 
    switchDashboardView('daily'); 
    alert("✅ ইনভয়েস মুছে ফেলা হয়েছে!");
}

function renderSalesHistory(filterCus = "All") {
    const tbody = document.getElementById('sales-history-body'); 
    if (!tbody) return; 
    
    let tS = 0;
    let tP = 0;
    let tD = 0; 
    let html = ''; 
    let lastDate = ''; 
    let todayStr = new Date().toLocaleDateString('en-US'); 
    
    let sortedSales = [...salesHistoryDB].sort((a, b) => new Date(b.rawDate || b.date) - new Date(a.rawDate || a.date));
    
    sortedSales.forEach(s => {
        if (filterCus === "All" || s.customer === filterCus) {
            tS += s.total; 
            tP += s.paid; 
            tD += s.due; 
            
            let sDate = s.date.split(',')[0].trim(); 
            let timeStr = s.date.split(',')[1] ? s.date.split(',')[1].trim() : '';
            
            if (sDate !== lastDate) { 
                let displayDate = (sDate === todayStr) ? `আজকের সেল (Today)` : `তারিখ: ${sDate}`; 
                html += `
                <tr style="background: #e0f2fe; color: #000; border-top: 2px solid #000;">
                    <td colspan="7" style="padding: 10px; font-size: 15px;"><b><i class="fa-solid fa-calendar-day"></i> ${displayDate}</b></td>
                </tr>`; 
                lastDate = sDate; 
            }
            
            html += `
            <tr>
                <td style="color:#000;"><b>${s.invoice}</b><br><small style="color:#000; font-weight:bold;">${timeStr}</small></td>
                <td style="color:#000; font-weight:bold;">${sDate}</td>
                <td style="color:#000;"><b>${s.customer}</b></td>
                <td style="font-weight:bold; color:#000;">৳ ${s.total.toFixed(2)}</td>
                <td style="color:#059669; font-weight:bold;">৳ ${s.paid.toFixed(2)}</td>
                <td style="color:#dc2626; font-weight:bold;">৳ ${s.due.toFixed(2)}</td>
                <td class="no-print" style="display:flex; gap:5px;">
                    <button class="btn btn-primary btn-small" onclick="viewInvoice('${s.invoice}')" title="View"><i class="fa-solid fa-eye"></i></button>
                    <button class="btn btn-danger btn-small" onclick="deleteInvoice('${s.invoice}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`;
        }
    });
    
    tbody.innerHTML = html || `<tr><td colspan="7" style="text-align:center; padding:20px; color:#000; font-weight:bold;">কোনো সেলস ডাটা নেই!</td></tr>`;
    
    let fts = document.getElementById('filter-total-sell'); 
    if (fts) fts.innerText = `৳ ${tS.toFixed(2)}`;
    
    let ftp = document.getElementById('filter-total-paid'); 
    if (ftp) ftp.innerText = `৳ ${tP.toFixed(2)}`;
    
    let ftd = document.getElementById('filter-total-due'); 
    if (ftd) ftd.innerText = `৳ ${tD.toFixed(2)}`;
}

function filterSalesHistory() { 
    let sel = document.getElementById('sales-customer-filter'); 
    if (sel) {
        renderSalesHistory(sel.value); 
    }
}

// ============================================================================
// LEDGER & DUE MANAGEMENT
// ============================================================================
function viewCustomerLedger(name) { 
    activeLedgerCus = name; 
    let c = customersDB.find(cus => cus.name === name); 
    if (!c) return; 
    
    document.getElementById('history-cus-name').innerText = c.name; 
    document.getElementById('ledger-tot-due').innerText = `৳ ${c.due.toFixed(2)}`; 
    
    let tbody = document.getElementById('history-list-body'); 
    tbody.innerHTML = ''; 
    let totalBuy = 0; 
    let combinedHistory = [];
    
    salesHistoryDB.forEach(s => { 
        if (s.customer === name) { 
            totalBuy += s.total; 
            combinedHistory.push({ type: 'sale', time: s.rawDate || new Date(s.date).getTime(), dateStr: s.date.split(',')[0], invoice: s.invoice, totalBill: s.total, dueAdded: s.due }); 
        } 
    }); 
    
    dueCollectionHistoryDB.forEach(col => { 
        if (col.customer === name) { 
            combinedHistory.push({ type: 'payment', time: col.rawDate || new Date(col.date).getTime(), dateStr: col.date.split(',')[0] || col.date, amount: col.amount }); 
        } 
    }); 
    
    combinedHistory.sort((a, b) => b.time - a.time);
    
    if (combinedHistory.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:15px; color:#000;">কোনো লেনদেনের হিস্ট্রি নেই!</td></tr>'; 
    } else { 
        combinedHistory.forEach(item => { 
            if (item.type === 'sale') { 
                let dueText = item.dueAdded > 0 ? `<br><small style="color:#ef4444;">বাকি যোগ: ৳${item.dueAdded.toFixed(2)}</small>` : `<br><small style="color:#059669;">Full Paid</small>`; 
                tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #cbd5e1;">
                    <td>${item.dateStr}</td>
                    <td style="color:#000; font-weight:bold;">Bill (${item.invoice})${dueText}</td>
                    <td style="color:#ef4444; font-weight:bold;">- ৳${item.totalBill.toFixed(2)}</td>
                </tr>`; 
            } else { 
                tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #cbd5e1; background: #ecfdf5;">
                    <td>${item.dateStr}</td>
                    <td style="color:#059669; font-weight:bold;"><i class="fa-solid fa-hand-holding-dollar"></i> পেমেন্ট রিসিভ</td>
                    <td style="color:#059669; font-weight:bold;">+ ৳${item.amount.toFixed(2)}</td>
                </tr>`; 
            } 
        }); 
    }
    
    document.getElementById('ledger-tot-buy').innerText = `৳ ${totalBuy.toFixed(2)}`; 
    document.getElementById('historyModal').classList.remove('hidden'); 
}

function receiveDuePrompt() { 
    let amt = parseFloat(prompt(`কত টাকা রিসিভ করছেন?`)); 
    if (amt > 0) { 
        let c = customersDB.find(cus => cus.name === activeLedgerCus); 
        c.due = Math.max(0, c.due - amt); 
        
        dueCollectionHistoryDB.unshift({ 
            date: new Date().toLocaleString(), 
            rawDate: new Date().getTime(), 
            customer: activeLedgerCus, 
            amount: amt 
        }); 
        
        saveData(); 
        alert("Payment Received!"); 
        viewCustomerLedger(activeLedgerCus); 
        renderAllTables(); 
        switchDashboardView('daily'); 
    } 
}

function renderDueTable() {
    const tbody = document.getElementById('due-list-body'); 
    if (!tbody) return; 
    
    let searchInput = document.getElementById('due-search');
    let searchKeyword = searchInput ? searchInput.value.toLowerCase() : "";
    
    let sortSelect = document.getElementById('due-sort');
    let sortType = sortSelect ? sortSelect.value : "high";
    
    let debtors = [...customersDB].filter(c => c.name.toLowerCase().includes(searchKeyword) || c.phone.includes(searchKeyword));
    
    if (sortType === 'high' || sortType === 'old') { 
        debtors.sort((a, b) => b.due - a.due); 
    } else if (sortType === 'name') { 
        debtors.sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true})); 
    }
    
    tbody.innerHTML = ''; 
    let totalDue = 0; 
    let actualDebtorsCount = 0;
    
    debtors.forEach(c => { 
        totalDue += c.due; 
        if (c.due > 0) actualDebtorsCount++; 
        
        let dueColor = c.due > 0 ? '#dc2626' : '#059669'; 
        
        tbody.innerHTML += `
        <tr>
            <td onclick="viewCustomerLedger('${c.name}')" style="cursor:pointer; color:#000;">
                <b>${c.name}</b><br>
                <small style="color:#000; font-weight:bold;">${c.phone}</small>
            </td>
            <td style="color:#000; font-weight:bold; font-size: 13px;">View Ledger</td>
            <td style="color:${dueColor}; font-weight:bold; font-size:16px;">৳ ${c.due.toFixed(2)}</td>
            <td class="no-print" style="text-align: center;">
                <button class="btn btn-warning btn-small" onclick="viewCustomerLedger('${c.name}')">
                    <i class="fa-solid fa-clock-rotate-left"></i> History
                </button>
            </td>
        </tr>`; 
    });
    
    let tmd = document.getElementById('total-market-due-display'); 
    if (tmd) tmd.innerText = `৳ ${totalDue.toFixed(2)}`; 
    
    let tdd = document.getElementById('total-debtors-display'); 
    if (tdd) tdd.innerText = `${actualDebtorsCount} জন`;
}

// ============================================================================
// COST & EXPENSES MANAGEMENT
// ============================================================================
function switchCostTab(type) { 
    currentCostTab = type; 
    
    let bD = document.getElementById('btn-daily-cost'); 
    if (bD) bD.classList.replace(type === 'daily' ? 'btn-outline' : 'btn-primary', type === 'daily' ? 'btn-primary' : 'btn-outline'); 
    
    let bM = document.getElementById('btn-monthly-cost'); 
    if (bM) bM.classList.replace(type === 'monthly' ? 'btn-outline' : 'btn-primary', type === 'monthly' ? 'btn-primary' : 'btn-outline'); 
    
    let eD = document.getElementById('exp-cat-daily'); 
    if (eD) eD.classList.toggle('hidden', type !== 'daily'); 
    
    let eM = document.getElementById('exp-cat-monthly'); 
    if (eM) eM.classList.toggle('hidden', type !== 'monthly'); 
    
    updateCostUI(); 
}

function saveCategory() { 
    let catName = document.getElementById('newCatName').value; 
    if (!catName) return; 
    
    let t = currentCostTab === 'daily' ? document.getElementById('exp-cat-daily') : document.getElementById('exp-cat-monthly'); 
    
    let opt = document.createElement('option'); 
    opt.text = catName; 
    t.add(opt); 
    t.value = catName; 
    
    document.getElementById('addCatModal').classList.add('hidden'); 
}

function addExpense() { 
    let dCat = document.getElementById('exp-cat-daily'); 
    let mCat = document.getElementById('exp-cat-monthly'); 
    
    const cat = currentCostTab === 'daily' ? (dCat ? dCat.value : 'Other') : (mCat ? mCat.value : 'Other'); 
    const amount = parseFloat(document.getElementById('exp-amount').value) || 0; 
    
    if (amount === 0) return alert("টাকা দিন!"); 
    
    expensesDB.unshift({ 
        id: Date.now(), 
        type: currentCostTab, 
        cat: cat, 
        amount: amount, 
        date: new Date().toLocaleString('en-US'), 
        rawDate: new Date().getTime() 
    }); 
    
    saveData(); 
    updateCostUI(); 
    switchDashboardView('daily'); 
    
    document.getElementById('exp-amount').value = ''; 
    document.getElementById('exp-note').value = ''; 
}

function deleteExpense(id) { 
    expensesDB = expensesDB.filter(e => e.id !== id); 
    saveData(); 
    updateCostUI(); 
    switchDashboardView('daily'); 
}

function updateCostUI() { 
    const costList = document.getElementById('exp-list-body'); 
    if (!costList) return; 
    
    costList.innerHTML = ''; 
    let total = 0; 
    
    expensesDB.filter(e => e.type === currentCostTab).forEach(e => { 
        total += e.amount; 
        costList.innerHTML += `
        <tr>
            <td style="color:#000; font-weight:bold;">${e.cat} <small>(${e.date})</small></td>
            <td style="color:#dc2626; font-weight:bold;">৳ ${e.amount.toFixed(2)}</td>
            <td><button class="btn btn-danger btn-small" onclick="deleteExpense(${e.id})">X</button></td>
        </tr>`; 
    }); 
    
    let ted = document.getElementById('total-exp-display'); 
    if (ted) ted.innerText = `৳ ${total.toFixed(2)}`; 
}

// ============================================================================
// ANALYTICS & DASHBOARD (CHARTS & TRENDS)
// ============================================================================
function renderHistoricalReport() {
    let filterElem = document.getElementById('history-filter-type');
    const filterType = filterElem ? filterElem.value : 'monthly';
    const tbody = document.getElementById('historical-report-body'); 
    
    if (!tbody) return; 
    let reportData = {};

    const getFormatKey = (dateStr, rawDate) => { 
        let d = rawDate ? new Date(rawDate) : new Date(dateStr); 
        if (filterType === 'daily') {
            return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }); 
        }
        if (filterType === 'monthly') {
            return d.toLocaleString('en-US', { month: 'long', year: 'numeric' }); 
        }
        if (filterType === 'yearly') {
            return d.getFullYear().toString(); 
        }
        return d.toLocaleDateString('en-US'); 
    };

    const initOrAdd = (key) => { 
        if (!reportData[key]) { 
            reportData[key] = { sell: 0, cost: 0, newDue: 0, dueCol: 0, profit: 0, timestamp: 0 }; 
        } 
    };

    salesHistoryDB.forEach(s => { 
        let key = getFormatKey(s.date, s.rawDate); 
        initOrAdd(key); 
        
        reportData[key].sell += s.total; 
        reportData[key].newDue += s.due; 
        
        let profit = s.profit !== undefined ? s.profit : (s.total * 0.15); 
        reportData[key].profit += profit; 
        reportData[key].timestamp = s.rawDate || new Date(s.date).getTime(); 
    });

    expensesDB.forEach(e => { 
        let key = getFormatKey(e.date, e.rawDate); 
        initOrAdd(key); 
        reportData[key].cost += e.amount; 
        reportData[key].timestamp = Math.max(reportData[key].timestamp, (e.rawDate || new Date(e.date).getTime())); 
    });

    dueCollectionHistoryDB.forEach(c => { 
        let key = getFormatKey(c.date, c.rawDate); 
        initOrAdd(key); 
        reportData[key].dueCol += c.amount; 
        reportData[key].timestamp = Math.max(reportData[key].timestamp, (c.rawDate || new Date(c.date).getTime())); 
    });

    let reportArray = Object.keys(reportData).map(k => ({ label: k, ...reportData[k] })); 
    reportArray.sort((a, b) => b.timestamp - a.timestamp);

    tbody.innerHTML = '';
    
    if (reportArray.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 15px; color: #000; font-weight:bold;">কোনো রিপোর্ট ডাটা পাওয়া যায়নি!</td></tr>'; 
        return; 
    }

    reportArray.forEach(item => { 
        let netProfit = item.profit - item.cost; 
        let profitColor = netProfit >= 0 ? '#059669' : '#dc2626'; 
        
        tbody.innerHTML += `
        <tr style="border-bottom: 1px solid #cbd5e1;">
            <td style="color:#000; font-weight:bold;"><i class="fa-regular fa-calendar"></i> ${item.label}</td>
            <td style="color:#3b82f6; font-weight:bold;">৳ ${item.sell.toFixed(2)}</td>
            <td style="color:#dc2626; font-weight:bold;">৳ ${item.cost.toFixed(2)}</td>
            <td style="color:#f59e0b; font-weight:bold;">৳ ${item.newDue.toFixed(2)}</td>
            <td style="color:#059669; font-weight:bold;">৳ ${item.dueCol.toFixed(2)}</td>
            <td style="color:${profitColor}; font-weight:bold; background: #f8fafc;">৳ ${netProfit.toFixed(2)}</td>
        </tr>`; 
    });
}

function renderFullAnalytics() {
    let ttp = document.getElementById('stat-tot-prod'); 
    if (ttp) ttp.innerText = productsDB.length; 
    
    let ttc = document.getElementById('stat-tot-cus'); 
    if (ttc) ttc.innerText = customersDB.length;
    
    let totDue = customersDB.reduce((sum, cus) => sum + cus.due, 0); 
    let std = document.getElementById('stat-tot-due'); 
    if (std) std.innerText = `৳ ${totDue.toFixed(2)}`; 
    
    let totSale = salesHistoryDB.reduce((sum, sale) => sum + sale.total, 0); 
    let sts = document.getElementById('stat-tot-sale'); 
    if (sts) sts.innerText = `৳ ${totSale.toFixed(2)}`; 
    
    let totalInvestment = productsDB.reduce((sum, p) => sum + (p.buy * (p.stock > 0 ? p.stock : 0)), 0); 
    let sti = document.getElementById('stat-tot-invest'); 
    if (sti) sti.innerText = `৳ ${totalInvestment.toFixed(2)}`;

    let trendBox = document.getElementById('price-trend-dashboard');
    if (!trendBox) { 
        let printArea = document.getElementById('analytics-print-area'); 
        if (printArea) { 
            let trDiv = document.createElement('div'); 
            trDiv.innerHTML = `
            <div style="background: #ffffff; padding: 20px; border-radius: 10px; margin-top: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 2px solid #000;">
                <h3 style="margin-bottom: 15px; color: #000; font-size: 18px; font-weight:bold;">
                    <i class="fa-solid fa-chart-line"></i> Price Trends (দাম কমা-বাড়া)
                </h3>
                <div id="price-trend-dashboard"></div>
            </div>`; 
            printArea.appendChild(trDiv); 
            trendBox = document.getElementById('price-trend-dashboard'); 
        } 
    }
    
    if (trendBox) {
        let trendHtml = ''; 
        let changedProducts = productsDB.filter(p => p.priceTrend === 'up' || p.priceTrend === 'down');
        
        if (changedProducts.length === 0) { 
            trendBox.innerHTML = '<p style="color:#000; font-weight:bold; text-align:center; padding: 15px 0;">কোনো প্রোডাক্টের দাম পরিবর্তন হয়নি।</p>'; 
        } else { 
            changedProducts.forEach(p => { 
                let trendIcon = p.priceTrend === 'up' ? '<i class="fa-solid fa-arrow-trend-up"></i> Barse' : '<i class="fa-solid fa-arrow-trend-down"></i> Komse'; 
                let trendColor = p.priceTrend === 'up' ? '#dc2626' : '#059669'; 
                
                trendHtml += `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #cbd5e1;">
                    <div style="font-weight:bold; color:#000; font-size: 15px;">${p.name}</div>
                    <div style="color:${trendColor}; font-weight:bold; padding:5px 10px; border: 1px solid ${trendColor}; border-radius:6px; font-size:14px;">
                        ${trendIcon} (৳${p.trendDiff.toFixed(2)})
                    </div>
                </div>`; 
            }); 
            trendBox.innerHTML = trendHtml; 
        }
    }
    
    updateAdvChart(); 
    renderHistoricalReport();
}

function updateAdvChart() {
    let ctx = document.getElementById('advancedAnalyticsChart'); 
    if (!ctx || typeof Chart === 'undefined') return;
    
    let salesData = new Array(12).fill(0); 
    let profitData = new Array(12).fill(0); 
    let costData = new Array(12).fill(0); 
    let currentYear = new Date().getFullYear();
    
    salesHistoryDB.forEach(s => { 
        let d = new Date(s.rawDate || s.date); 
        if (d.getFullYear() === currentYear) { 
            salesData[d.getMonth()] += s.total; 
            profitData[d.getMonth()] += (s.profit !== undefined ? s.profit : (s.total * 0.15)); 
        } 
    });
    
    expensesDB.forEach(e => { 
        let d = new Date(e.rawDate || e.date); 
        if (d.getFullYear() === currentYear) { 
            costData[d.getMonth()] += e.amount; 
        } 
    });
    
    if (advAnalyticsChart) {
        advAnalyticsChart.destroy();
    }
    
    advAnalyticsChart = new Chart(ctx, { 
        type: 'line', 
        data: { 
            labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], 
            datasets: [
                { label: 'Sales (৳)', data: salesData, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, tension: 0.3 }, 
                { label: 'Profit (৳)', data: profitData, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.3 }, 
                { label: 'Cost (৳)', data: costData, borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', fill: true, tension: 0.3 }
            ] 
        }, 
        options: { 
            responsive: true, 
            maintainAspectRatio: false 
        } 
    });
}

function switchDashboardView(viewMode) {
    let now = new Date(); 
    let tSell = 0, tProfit = 0, tDueCol = 0, tCost = 0, countBills = 0; 
    let mSell = 0, mProfit = 0, mCost = 0; 
    
    salesHistoryDB.forEach(sale => { 
        let sd = new Date(sale.rawDate || sale.date); 
        let profitAmt = sale.profit !== undefined ? sale.profit : (sale.total - (sale.total * 0.85)); 
        
        if (sd.getMonth() === now.getMonth() && sd.getFullYear() === now.getFullYear()) { 
            mSell += sale.total; 
            mProfit += profitAmt; 
        } 
        
        if (sd.toDateString() === now.toDateString()) { 
            tSell += sale.total; 
            tProfit += profitAmt; 
            countBills++; 
        } 
    });
    
    dueCollectionHistoryDB.forEach(col => { 
        let cd = new Date(col.rawDate || col.date); 
        if (cd.toDateString() === now.toDateString()) {
            tDueCol += col.amount; 
        }
    }); 
    
    expensesDB.forEach(exp => { 
        let ed = exp.rawDate ? new Date(exp.rawDate) : new Date(exp.date); 
        if (ed.getMonth() === now.getMonth() && ed.getFullYear() === now.getFullYear()) { 
            mCost += exp.amount; 
        } 
        if (ed.toDateString() === now.toDateString()) { 
            tCost += exp.amount; 
        } 
    });
    
    let totalMarketDue = customersDB.reduce((sum, cus) => sum + cus.due, 0); 
    let tNetProfit = tProfit - tCost; 
    let mNetProfit = mProfit - mCost;
    
    let dtp = document.getElementById('dash-today-profit'); 
    if (dtp) dtp.innerText = `৳ ${tProfit.toFixed(2)}`; 
    
    let dtnp = document.getElementById('dash-today-net-profit'); 
    if (dtnp) dtnp.innerText = `৳ ${tNetProfit.toFixed(2)}`; 
    
    let dts = document.getElementById('dash-today-sell'); 
    if (dts) dts.innerText = `৳ ${tSell.toFixed(2)}`; 
    
    let dtc = document.getElementById('dash-today-cost'); 
    if (dtc) dtc.innerText = `৳ ${tCost.toFixed(2)}`; 
    
    let dtdc = document.getElementById('dash-today-due-col'); 
    if (dtdc) dtdc.innerText = `৳ ${tDueCol.toFixed(2)}`; 
    
    let dca = document.getElementById('dash-today-cash'); 
    if (dca) dca.innerText = `৳ ${((tSell + tDueCol) - tCost).toFixed(2)}`; 
    
    let dtb = document.getElementById('dash-today-bills'); 
    if (dtb) dtb.innerText = `${countBills} টি`; 
    
    let dms = document.getElementById('dash-month-sell'); 
    if (dms) dms.innerText = `৳ ${mSell.toFixed(2)}`; 
    
    let dmp = document.getElementById('dash-month-profit'); 
    if (dmp) dmp.innerText = `৳ ${mProfit.toFixed(2)}`; 
    
    let dmc = document.getElementById('dash-month-cost'); 
    if (dmc) dmc.innerText = `৳ ${mCost.toFixed(2)}`; 
    
    let dmnp = document.getElementById('dash-month-net-profit'); 
    if (dmnp) dmnp.innerText = `৳ ${mNetProfit.toFixed(2)}`; 
    
    let dtd = document.getElementById('dash-total-due'); 
    if (dtd) dtd.innerText = `৳ ${totalMarketDue.toFixed(2)}`;
    
    updateChartData(); 
}

function initChart() { 
    const ctx1 = document.getElementById('myChart'); 
    if (!ctx1) return; 
    
    if (salesChart) { 
        salesChart.destroy(); 
    }
    
    let config = { 
        type: 'line', 
        data: { 
            labels: ['6 Days Ago','5 Days Ago','4 Days Ago','3 Days Ago','2 Days Ago','Yesterday','Today'], 
            datasets: [{ 
                label: 'Sales Trend (৳)', 
                data: [0,0,0,0,0,0,0], 
                borderColor: '#3b82f6', 
                backgroundColor: 'rgba(59, 130, 246, 0.2)', 
                borderWidth: 2, 
                fill: true, 
                tension: 0.4 
            }] 
        }, 
        options: { 
            responsive: true, 
            maintainAspectRatio: false 
        } 
    }; 
    
    if (typeof Chart !== 'undefined') {
        salesChart = new Chart(ctx1, config); 
    }
}

function updateChartData() { 
    if (!salesChart) return; 
    
    let dayTotals = [0,0,0,0,0,0,0]; 
    let labels = []; 
    
    for (let i = 6; i >= 0; i--) { 
        let d = new Date(); 
        d.setDate(d.getDate() - i); 
        labels.push(i === 0 ? 'Today' : i === 1 ? 'Yesterday' : d.toLocaleDateString('en-US', {weekday:'short'})); 
        
        salesHistoryDB.forEach(s => { 
            let sd = new Date(s.rawDate || s.date); 
            if (sd.toDateString() === d.toDateString()) {
                dayTotals[6-i] += s.total; 
            }
        }); 
    } 
    
    salesChart.data.labels = labels; 
    salesChart.data.datasets[0].data = dayTotals; 
    salesChart.update(); 
}

// ============================================================================
// UTILITIES (PRINTING & OTHERS)
// ============================================================================
function printHTML(htmlContent) {
    let printFrame = document.getElementById('print-frame');
    
    if (!printFrame) { 
        printFrame = document.createElement('iframe'); 
        printFrame.id = 'print-frame'; 
        printFrame.style.position = 'fixed'; 
        printFrame.style.right = '0'; 
        printFrame.style.bottom = '0'; 
        printFrame.style.width = '0'; 
        printFrame.style.height = '0'; 
        printFrame.style.border = '0'; 
        document.body.appendChild(printFrame); 
    }
    
    let doc = printFrame.contentWindow.document; 
    doc.open(); 
    doc.write(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>SmartPOS Report</title>
        <style>
            body { font-family: 'Hind Siliguri', sans-serif, Arial; color: #000; padding: 20px; background: white; } 
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 14px; text-align: left; } 
            th, td { border: 1px solid #000; padding: 8px; color:#000; font-weight:bold; } 
            th { background: #f8fafc; font-weight: bold; -webkit-print-color-adjust: exact; print-color-adjust: exact; } 
            .no-print { display: none !important; } 
            img { max-width: 100%; height: auto; }
        </style>
    </head>
    <body>
        ${htmlContent}
    </body>
    </html>`); 
    doc.close(); 
    
    setTimeout(() => { 
        printFrame.contentWindow.focus(); 
        printFrame.contentWindow.print(); 
    }, 500);
}

function printReport(areaId) { 
    const sourceArea = document.getElementById(areaId); 
    if (!sourceArea) return alert("প্রিন্ট এরিয়া পাওয়া যাচ্ছে না!"); 
    
    let htmlContent = "";
    
    if (sourceArea.tagName.toLowerCase() === 'tbody') { 
        let parentTable = sourceArea.closest('table'); 
        if (parentTable) { 
            let cloneTable = parentTable.cloneNode(true); 
            cloneTable.querySelectorAll('.no-print').forEach(el => el.remove()); 
            htmlContent = cloneTable.outerHTML; 
        } else { 
            htmlContent = `<table>${sourceArea.innerHTML}</table>`; 
        } 
    } else { 
        let tempDiv = document.createElement('div'); 
        tempDiv.innerHTML = sourceArea.outerHTML; 
        let originalCanvases = sourceArea.getElementsByTagName('canvas'); 
        let clonedCanvases = tempDiv.getElementsByTagName('canvas'); 
        
        for (let i = 0; i < originalCanvases.length; i++) { 
            let img = document.createElement('img'); 
            img.src = originalCanvases[i].toDataURL("image/png"); 
            clonedCanvases[i].parentNode.replaceChild(img, clonedCanvases[i]); 
        } 
        
        tempDiv.querySelectorAll('.no-print').forEach(el => el.remove()); 
        htmlContent = tempDiv.innerHTML; 
    }
    
    let invoiceModal = document.getElementById('invoiceModal'); 
    if (invoiceModal) {
        invoiceModal.classList.add('hidden'); 
    }
    printHTML(htmlContent);
}

function switchPage(pageId) {
    document.querySelectorAll('.page-section').forEach(p => { 
        p.classList.add('hidden'); 
        p.classList.remove('active'); 
    }); 
    
    document.querySelectorAll('.nav-menu li').forEach(li => {
        li.classList.remove('active');
    }); 
    
    const target = document.getElementById(pageId); 
    if (target) { 
        target.classList.remove('hidden'); 
        target.classList.add('active'); 
    } 
    
    document.querySelectorAll('.nav-menu li').forEach(li => { 
        if (li.getAttribute('onclick') && li.getAttribute('onclick').includes(`'${pageId}'`)) {
            li.classList.add('active'); 
        }
    });
    
    if (pageId === 'dashboard') switchDashboardView('daily'); 
    if (pageId === 'analytics') renderFullAnalytics(); 
    if (pageId === 'due') renderDueTable();
    if (pageId === 'profile') loadUserProfileData();
}

function updateTime() { 
    const t = document.getElementById('current-time'); 
    if (t) {
        t.innerText = new Date().toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }); 
    }
}

function checkNetworkStatus() { 
    const badge = document.getElementById('network-badge'); 
    if (!badge) return; 
    
    if (navigator.onLine) { 
        badge.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Online Sync'; 
        badge.style.background = '#10b981'; 
    } else { 
        badge.innerHTML = '<i class="fa-solid fa-wifi"></i> Offline Mode'; 
        badge.style.background = '#ef4444'; 
    } 
}

// ============================================================================
// SUPPORT & BARCODE MODALS
// ============================================================================
function openUserSupportModal() { 
    let m = document.getElementById('userSupportModal'); 
    if (m) m.classList.remove('hidden'); 
}

function submitSupportTicket() { 
    let msg = document.getElementById('user-support-msg'); 
    if (!msg || !msg.value.trim()) return alert("Message cannot be empty!"); 
    
    alert("✅ মেসেজ অ্যাডমিনের কাছে পাঠানো হয়েছে! খুব জলদি রিপ্লাই পাবেন।"); 
    msg.value = ''; 
    document.getElementById('userSupportModal').classList.add('hidden'); 
}

function printSingleBarcode(name) {
    let p = productsDB.find(prod => prod.name === name); 
    if (!p) return;
    
    let bcode = p.barcode && p.barcode.trim() !== "" 
        ? p.barcode 
        : Math.floor(Math.random() * 89999999 + 10000000).toString(); 
        
    if (document.getElementById('barcodeModal')) {
        document.getElementById('barcodeModal').classList.remove('hidden');
    }
    
    if (document.getElementById('barcode-shop-name')) document.getElementById('barcode-shop-name').innerText = shopName;
    if (document.getElementById('barcode-prod-name')) document.getElementById('barcode-prod-name').innerText = p.name;
    if (document.getElementById('barcode-price')) document.getElementById('barcode-price').innerText = `৳ ${p.sell}`;
    
    try { 
        JsBarcode("#barcode-svg", bcode, { 
            format: "CODE128", 
            lineColor: "#000", 
            width: 2, 
            height: 40, 
            displayValue: true, 
            fontSize: 14, 
            margin: 0 
        }); 
    } catch(e) { 
        console.log("Barcode error:", e); 
    }
}

function printBarcodeStickers() {
    let qtyInput = document.getElementById('barcode-qty');
    let qty = parseInt(qtyInput ? qtyInput.value : 1) || 1;
    
    let stickerHTML = document.getElementById('barcode-print-area').innerHTML;
    let fullPageHtml = `<div style="display:flex; flex-wrap:wrap; gap:10px; justify-content:center;">`;
    
    for (let i = 0; i < qty; i++) { 
        fullPageHtml += `<div style="border:1px solid #ccc; padding:10px; border-radius:5px; margin-bottom:10px;">${stickerHTML}</div>`; 
    }
    
    fullPageHtml += `</div>`;
    printHTML(fullPageHtml);
}

