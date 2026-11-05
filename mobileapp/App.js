import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  SafeAreaView, 
  StatusBar,
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  Platform
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

// Production Cloud Domain & Local Fallbacks
const PRODUCTION_URL = 'https://docvault.plystory.si/api';
const LOCAL_WIFI_URL = 'http://192.168.2.219:5000/api';

export default function App() {
  // Server URL State (defaults to production subdomain with one-tap toggle)
  const [apiUrl, setApiUrl] = useState(PRODUCTION_URL);
  const [showConfig, setShowConfig] = useState(false);

  // Auth State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Active Tab: 'vault' | 'users' | 'profile'
  const [activeTab, setActiveTab] = useState('vault');

  // Vault State
  const [folders, setFolders] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // User Management State (Superadmin)
  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Modals
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);

  // Form States: New Folder
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDesc, setNewFolderDesc] = useState('');

  // Form States: Document Upload
  const [selectedFile, setSelectedFile] = useState(null);
  const [docName, setDocName] = useState('');
  const [docType, setDocType] = useState('Contract');
  const [renewalDate, setRenewalDate] = useState('');
  const [docDesc, setDocDesc] = useState('');
  const [uploadFolderId, setUploadFolderId] = useState('');
  const [uploading, setUploading] = useState(false);

  // Form States: Register User (Superadmin)
  const [regName, setRegName] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState('user');
  const [regDept, setRegDept] = useState('General');
  const [registering, setRegistering] = useState(false);

  const isSuperadmin = user?.role === 'superadmin';

  // Fill Superadmin Credentials
  const fillSuperadmin = () => {
    setEmail('ithelpdesk@plystory.com');
    setPassword('Admin@2026');
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Required', 'Please enter email and password');
      return;
    }

    setAuthLoading(true);
    try {
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Authentication failed');
      }

      setUser(data.user);
      setToken(data.token);
      loadVault(data.token);
      if (data.user.role === 'superadmin') {
        loadUsers(data.token);
      }
    } catch (err) {
      Alert.alert(
        'Connection / Login Error',
        `${err.message}\n\nCurrent Server: ${apiUrl}\n\nTip: If testing offline or on local Wi-Fi, tap "Server URL Configuration" below and switch to Local Wi-Fi IP.`
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const loadVault = async (authToken) => {
    const tk = authToken || token;
    if (!tk) return;
    setRefreshing(true);
    try {
      const [fRes, dRes] = await Promise.all([
        fetch(`${apiUrl}/vault/folders`, { headers: { Authorization: `Bearer ${tk}` } }),
        fetch(`${apiUrl}/vault/documents`, { headers: { Authorization: `Bearer ${tk}` } })
      ]);
      const fData = await fRes.json();
      const dData = await dRes.json();

      if (fData.success) setFolders(fData.folders || []);
      if (dData.success) setDocuments(dData.documents || []);
    } catch (err) {
      console.error('Load vault error:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const loadUsers = async (authToken) => {
    const tk = authToken || token;
    if (!tk) return;
    setLoadingUsers(true);
    try {
      const res = await fetch(`${apiUrl}/auth/users`, {
        headers: { Authorization: `Bearer ${tk}` }
      });
      const data = await res.json();
      if (data.success) {
        setUsersList(data.users || []);
      }
    } catch (err) {
      console.error('Load users error:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Create Folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      Alert.alert('Required', 'Please enter a folder name.');
      return;
    }
    try {
      const res = await fetch(`${apiUrl}/vault/folders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: newFolderName.trim(), description: newFolderDesc.trim() })
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Success', `Folder "${data.folder.name}" created!`);
        setNewFolderName('');
        setNewFolderDesc('');
        setFolderModalOpen(false);
        loadVault(token);
      } else {
        Alert.alert('Error', data.message);
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  // Superadmin Delete Folder
  const handleDeleteFolder = (folder) => {
    if (!isSuperadmin) return;
    Alert.alert(
      'Delete Folder',
      `Delete "${folder.name}"? Files will be kept safely in the root Vault.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${apiUrl}/vault/folders/${folder.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
              });
              const data = await res.json();
              if (data.success) {
                if (selectedFolder === folder.id) setSelectedFolder('ALL');
                loadVault(token);
              } else {
                Alert.alert('Error', data.message);
              }
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          }
        }
      ]
    );
  };

  // Pick Document File from Device
  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        type: '*/*'
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setSelectedFile(file);
        if (!docName) {
          const baseName = file.name.replace(/\.[^/.]+$/, "");
          setDocName(baseName);
        }
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to pick file: ' + err.message);
    }
  };

  // Upload Document to Vault
  const handleUploadDocument = async () => {
    if (!selectedFile) {
      Alert.alert('Required', 'Please choose a file to upload.');
      return;
    }
    if (!docName.trim()) {
      Alert.alert('Required', 'Document name is required.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: selectedFile.uri,
        name: selectedFile.name,
        type: selectedFile.mimeType || 'application/octet-stream'
      });
      formData.append('name', docName.trim());
      formData.append('doc_type', docType);
      if (renewalDate.trim()) formData.append('renewal_date', renewalDate.trim());
      if (docDesc.trim()) formData.append('description', docDesc.trim());
      if (uploadFolderId) formData.append('folder_id', uploadFolderId);

      const res = await fetch(`${apiUrl}/vault/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (data.success) {
        Alert.alert('Success', `"${data.document.name}" secured in Vault!`);
        setSelectedFile(null);
        setDocName('');
        setRenewalDate('');
        setDocDesc('');
        setUploadFolderId('');
        setUploadModalOpen(false);
        loadVault(token);
      } else {
        Alert.alert('Upload Failed', data.message);
      }
    } catch (err) {
      Alert.alert('Upload Error', err.message);
    } finally {
      setUploading(false);
    }
  };

  // View / Download / Share Document
  const handleDownloadAndShare = async (doc) => {
    try {
      const downloadUrl = `${apiUrl}/vault/download/${doc.id}`;
      const localUri = `${FileSystem.documentDirectory}${doc.original_filename}`;

      Alert.alert('Downloading', `Fetching ${doc.original_filename}...`);
      const { uri } = await FileSystem.downloadAsync(downloadUrl, localUri);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert('Downloaded', `File saved to: ${uri}`);
      }
    } catch (err) {
      Alert.alert('Error', 'Could not download or open file: ' + err.message);
    }
  };

  // Delete Document
  const handleDeleteDocument = (doc) => {
    Alert.alert(
      'Delete Document',
      `Delete "${doc.name}" from Vault?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${apiUrl}/vault/documents/${doc.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
              });
              const data = await res.json();
              if (data.success) {
                loadVault(token);
              } else {
                Alert.alert('Error', data.message);
              }
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          }
        }
      ]
    );
  };

  // Superadmin: Register New User
  const handleRegisterUser = async () => {
    if (!regName.trim() || !regMobile.trim() || !regEmail.trim() || !regPassword) {
      Alert.alert('Required', 'Name, mobile, email, and password are all required.');
      return;
    }

    setRegistering(true);
    try {
      const res = await fetch(`${apiUrl}/auth/register-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: regName.trim(),
          mobile: regMobile.trim(),
          email: regEmail.trim(),
          password: regPassword,
          role: regRole,
          department: regDept.trim()
        })
      });

      const data = await res.json();
      if (data.success) {
        Alert.alert('Success', `User "${data.user.name}" registered successfully!`);
        setRegName('');
        setRegMobile('');
        setRegEmail('');
        setRegPassword('');
        setRegisterModalOpen(false);
        loadUsers(token);
      } else {
        Alert.alert('Error', data.message);
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setRegistering(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    setDocuments([]);
    setFolders([]);
    setUsersList([]);
    setEmail('');
    setPassword('');
  };

  // Filtered documents
  const filteredDocs = documents.filter((doc) => {
    const matchesFolder = selectedFolder === 'ALL' || String(doc.folder_id) === String(selectedFolder);
    const matchesSearch = 
      doc.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.original_filename?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.doc_type?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFolder && matchesSearch;
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {user ? (
        <View style={styles.mainView}>
          {/* Header */}
          <View style={styles.topHeader}>
            <View>
              <View style={styles.titleRow}>
                <Text style={styles.brandTitle}>DocVault</Text>
                <View style={isSuperadmin ? styles.superadminBadge : styles.userBadge}>
                  <Text style={isSuperadmin ? styles.superadminBadgeText : styles.userBadgeText}>
                    {isSuperadmin ? 'SUPERADMIN' : 'VAULT USER'}
                  </Text>
                </View>
              </View>
              <Text style={styles.userSubtitle}>{user.name} • {user.email}</Text>
            </View>
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Text style={styles.logoutBtnText}>Logout</Text>
            </TouchableOpacity>
          </View>

          {/* Navigation Bar */}
          <View style={styles.navBar}>
            <TouchableOpacity 
              style={[styles.navTab, activeTab === 'vault' && styles.navTabActive]} 
              onPress={() => setActiveTab('vault')}
            >
              <Text style={[styles.navTabText, activeTab === 'vault' && styles.navTabTextActive]}>
                Vault ({documents.length})
              </Text>
            </TouchableOpacity>

            {isSuperadmin && (
              <TouchableOpacity 
                style={[styles.navTab, activeTab === 'users' && styles.navTabActive]} 
                onPress={() => {
                  setActiveTab('users');
                  loadUsers(token);
                }}
              >
                <Text style={[styles.navTabText, activeTab === 'users' && styles.navTabTextActive]}>
                  Users ({usersList.length})
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              style={[styles.navTab, activeTab === 'profile' && styles.navTabActive]} 
              onPress={() => setActiveTab('profile')}
            >
              <Text style={[styles.navTabText, activeTab === 'profile' && styles.navTabTextActive]}>
                Info & Host
              </Text>
            </TouchableOpacity>
          </View>

          {/* TAB 1: DOCUMENT VAULT */}
          {activeTab === 'vault' && (
            <View style={styles.tabContent}>
              {/* Quick Actions */}
              <View style={styles.actionRow}>
                <TouchableOpacity 
                  style={styles.uploadBtn}
                  onPress={() => setUploadModalOpen(true)}
                >
                  <Text style={styles.uploadBtnText}>+ Upload Document</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.createFolderBtn}
                  onPress={() => setFolderModalOpen(true)}
                >
                  <Text style={styles.createFolderBtnText}>+ Folder</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.refreshBtn}
                  onPress={() => loadVault(token)}
                >
                  <Text style={styles.refreshBtnText}>↻</Text>
                </TouchableOpacity>
              </View>

              {/* Folders List */}
              <View style={styles.folderSection}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.folderScroll}>
                  <TouchableOpacity
                    style={[styles.folderChip, selectedFolder === 'ALL' && styles.folderChipActive]}
                    onPress={() => setSelectedFolder('ALL')}
                  >
                    <Text style={[styles.folderChipText, selectedFolder === 'ALL' && styles.folderChipTextActive]}>
                      📁 All Files ({documents.length})
                    </Text>
                  </TouchableOpacity>

                  {folders.map(f => (
                    <TouchableOpacity
                      key={f.id}
                      style={[styles.folderChip, selectedFolder === f.id && styles.folderChipActive]}
                      onPress={() => setSelectedFolder(f.id)}
                      onLongPress={() => isSuperadmin && handleDeleteFolder(f)}
                    >
                      <Text style={[styles.folderChipText, selectedFolder === f.id && styles.folderChipTextActive]}>
                        📁 {f.name} ({f.doc_count || 0})
                      </Text>
                      {isSuperadmin && (
                        <TouchableOpacity onPress={() => handleDeleteFolder(f)} style={styles.folderDelBtn}>
                          <Text style={styles.folderDelText}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Search */}
              <View style={styles.searchBox}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="🔍 Search documents, filename, notes..."
                  placeholderTextColor="#94a3b8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>

              {/* Document List */}
              <FlatList
                data={filteredDocs}
                keyExtractor={(item) => String(item.id)}
                refreshing={refreshing}
                onRefresh={() => loadVault(token)}
                renderItem={({ item }) => {
                  const canDelete = isSuperadmin || item.uploaded_by === user.id;

                  return (
                    <View style={styles.docCard}>
                      <View style={styles.docHeader}>
                        <View style={styles.docTitleBlock}>
                          <Text style={styles.docName}>{item.name}</Text>
                          <Text style={styles.docMetaFilename}>{item.original_filename}</Text>
                        </View>
                        <View style={styles.badgeGroup}>
                          <Text style={styles.docTypeBadge}>{item.doc_type}</Text>
                        </View>
                      </View>

                      {item.description ? (
                        <Text style={styles.docDescText}>"{item.description}"</Text>
                      ) : null}

                      {item.renewal_date ? (
                        <View style={styles.renewalRow}>
                          <Text style={styles.renewalLabel}>📅 Renewal Date:</Text>
                          <Text style={styles.renewalValue}>{item.renewal_date}</Text>
                        </View>
                      ) : null}

                      <View style={styles.docFooter}>
                        <Text style={styles.docUploader}>
                          by {item.uploader_name || 'User'} • {(item.file_size / 1024).toFixed(1)} KB
                        </Text>

                        <View style={styles.docBtnRow}>
                          <TouchableOpacity 
                            style={styles.openBtn}
                            onPress={() => handleDownloadAndShare(item)}
                          >
                            <Text style={styles.openBtnText}>Open / Share</Text>
                          </TouchableOpacity>

                          {canDelete && (
                            <TouchableOpacity 
                              style={styles.deleteDocBtn}
                              onPress={() => handleDeleteDocument(item)}
                            >
                              <Text style={styles.deleteDocText}>Delete</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyTitle}>No documents in this view</Text>
                    <Text style={styles.emptySubtitle}>Tap "+ Upload Document" to upload your first file.</Text>
                  </View>
                }
              />
            </View>
          )}

          {/* TAB 2: USER DIRECTORY (Superadmin Only) */}
          {activeTab === 'users' && isSuperadmin && (
            <View style={styles.tabContent}>
              <View style={styles.actionRow}>
                <TouchableOpacity 
                  style={styles.uploadBtn}
                  onPress={() => setRegisterModalOpen(true)}
                >
                  <Text style={styles.uploadBtnText}>+ Register New User</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.refreshBtn}
                  onPress={() => loadUsers(token)}
                >
                  <Text style={styles.refreshBtnText}>↻</Text>
                </TouchableOpacity>
              </View>

              <FlatList
                data={usersList}
                keyExtractor={(item) => String(item.id)}
                refreshing={loadingUsers}
                onRefresh={() => loadUsers(token)}
                renderItem={({ item }) => (
                  <View style={styles.userCard}>
                    <View style={styles.userCardHeader}>
                      <View>
                        <Text style={styles.userNameText}>{item.name}</Text>
                        <Text style={styles.userEmailText}>{item.email}</Text>
                        <Text style={styles.userPhoneText}>📞 {item.mobile}</Text>
                      </View>
                      <View style={styles.userRoleBadge}>
                        <Text style={styles.userRoleText}>{item.role}</Text>
                      </View>
                    </View>
                    <View style={styles.userCardFooter}>
                      <Text style={styles.userDeptText}>Dept: {item.department || 'General'}</Text>
                      <Text style={item.status === 'active' ? styles.statusActive : styles.statusSuspended}>
                        ● {item.status}
                      </Text>
                    </View>
                  </View>
                )}
              />
            </View>
          )}

          {/* TAB 3: INFO & HOST SETTINGS */}
          {activeTab === 'profile' && (
            <ScrollView style={styles.tabContent}>
              <View style={styles.profileCard}>
                <Text style={styles.sectionHeader}>Authenticated Profile</Text>
                <View style={styles.infoLine}>
                  <Text style={styles.infoKey}>Name:</Text>
                  <Text style={styles.infoVal}>{user.name}</Text>
                </View>
                <View style={styles.infoLine}>
                  <Text style={styles.infoKey}>Email:</Text>
                  <Text style={styles.infoVal}>{user.email}</Text>
                </View>
                <View style={styles.infoLine}>
                  <Text style={styles.infoKey}>Role:</Text>
                  <Text style={styles.infoVal}>{user.role}</Text>
                </View>
                <View style={styles.infoLine}>
                  <Text style={styles.infoKey}>Department:</Text>
                  <Text style={styles.infoVal}>{user.department || 'General'}</Text>
                </View>
              </View>

              <View style={styles.profileCard}>
                <Text style={styles.sectionHeader}>Vault Summary</Text>
                <Text style={styles.metricText}>Total Files in Vault: {documents.length}</Text>
                <Text style={styles.metricText}>Total Folders: {folders.length}</Text>
                {isSuperadmin && <Text style={styles.metricText}>Total Users: {usersList.length}</Text>}
              </View>

              <View style={styles.profileCard}>
                <Text style={styles.sectionHeader}>Active API Server</Text>
                <Text style={styles.metricText}>{apiUrl}</Text>
                <TouchableOpacity 
                  style={styles.switchUrlBtn}
                  onPress={() => {
                    const next = apiUrl.includes('plystory.si') ? LOCAL_WIFI_URL : PRODUCTION_URL;
                    setApiUrl(next);
                    Alert.alert('Server Switched', `Active API is now:\n${next}`);
                  }}
                >
                  <Text style={styles.switchUrlBtnText}>
                    Switch to {apiUrl.includes('plystory.si') ? 'Local Wi-Fi IP' : 'Production Cloud Domain'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {/* MODAL 1: CREATE FOLDER */}
          <Modal visible={folderModalOpen} transparent animationType="slide">
            <View style={styles.modalBg}>
              <View style={styles.modalBox}>
                <Text style={styles.modalHeading}>Create New Vault Folder</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Folder Name (e.g. Legal, Finance)"
                  placeholderTextColor="#94a3b8"
                  value={newFolderName}
                  onChangeText={setNewFolderName}
                />
                <TextInput
                  style={styles.modalInput}
                  placeholder="Description (Optional)"
                  placeholderTextColor="#94a3b8"
                  value={newFolderDesc}
                  onChangeText={setNewFolderDesc}
                />
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setFolderModalOpen(false)}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.submitBtn} onPress={handleCreateFolder}>
                    <Text style={styles.submitBtnText}>Create Folder</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* MODAL 2: UPLOAD DOCUMENT */}
          <Modal visible={uploadModalOpen} transparent animationType="slide">
            <View style={styles.modalBg}>
              <ScrollView contentContainerStyle={styles.scrollModalBox}>
                <Text style={styles.modalHeading}>Upload Document to Vault</Text>

                {/* File Picker */}
                <TouchableOpacity style={styles.filePickerBox} onPress={handlePickDocument}>
                  <Text style={styles.filePickerIcon}>📄</Text>
                  {selectedFile ? (
                    <Text style={styles.filePickerSelected}>
                      Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </Text>
                  ) : (
                    <Text style={styles.filePickerPlaceholder}>
                      Tap here to select file from phone storage
                    </Text>
                  )}
                </TouchableOpacity>

                <Text style={styles.fieldLabel}>Document Name *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Master Services Agreement"
                  placeholderTextColor="#94a3b8"
                  value={docName}
                  onChangeText={setDocName}
                />

                <Text style={styles.fieldLabel}>Category / Type</Text>
                <View style={styles.typeChipsRow}>
                  {['Contract', 'Agreement', 'Policy', 'License', 'Invoice', 'General'].map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.typeChip, docType === t && styles.typeChipActive]}
                      onPress={() => setDocType(t)}
                    >
                      <Text style={[styles.typeChipText, docType === t && styles.typeChipTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Renewal Date (Optional)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="YYYY-MM-DD (e.g. 2026-12-31)"
                  placeholderTextColor="#94a3b8"
                  value={renewalDate}
                  onChangeText={setRenewalDate}
                />

                <Text style={styles.fieldLabel}>Vault Folder</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modalFolderScroll}>
                  <TouchableOpacity
                    style={[styles.folderSelectChip, uploadFolderId === '' && styles.folderSelectChipActive]}
                    onPress={() => setUploadFolderId('')}
                  >
                    <Text style={[styles.folderSelectText, uploadFolderId === '' && styles.folderSelectTextActive]}>
                      Root Vault
                    </Text>
                  </TouchableOpacity>
                  {folders.map(f => (
                    <TouchableOpacity
                      key={f.id}
                      style={[styles.folderSelectChip, uploadFolderId === f.id && styles.folderSelectChipActive]}
                      onPress={() => setUploadFolderId(f.id)}
                    >
                      <Text style={[styles.folderSelectText, uploadFolderId === f.id && styles.folderSelectTextActive]}>
                        {f.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.fieldLabel}>Notes / Description</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Additional terms or notes..."
                  placeholderTextColor="#94a3b8"
                  value={docDesc}
                  onChangeText={setDocDesc}
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setUploadModalOpen(false)}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.submitBtn} 
                    onPress={handleUploadDocument}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.submitBtnText}>Upload & Protect</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </Modal>

          {/* MODAL 3: REGISTER USER (Superadmin) */}
          <Modal visible={registerModalOpen} transparent animationType="slide">
            <View style={styles.modalBg}>
              <ScrollView contentContainerStyle={styles.scrollModalBox}>
                <Text style={styles.modalHeading}>Register New User</Text>

                <Text style={styles.fieldLabel}>Full Name *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Priya Sharma"
                  placeholderTextColor="#94a3b8"
                  value={regName}
                  onChangeText={setRegName}
                />

                <Text style={styles.fieldLabel}>Mobile Number *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. +91 9876543210"
                  placeholderTextColor="#94a3b8"
                  keyboardType="phone-pad"
                  value={regMobile}
                  onChangeText={setRegMobile}
                />

                <Text style={styles.fieldLabel}>Email Address *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="user@plystory.com"
                  placeholderTextColor="#94a3b8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={regEmail}
                  onChangeText={setRegEmail}
                />

                <Text style={styles.fieldLabel}>Password *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Min 6 characters"
                  placeholderTextColor="#94a3b8"
                  secureTextEntry
                  value={regPassword}
                  onChangeText={setRegPassword}
                />

                <Text style={styles.fieldLabel}>Department</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Legal, HR, Finance"
                  placeholderTextColor="#94a3b8"
                  value={regDept}
                  onChangeText={setRegDept}
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setRegisterModalOpen(false)}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.submitBtn} 
                    onPress={handleRegisterUser}
                    disabled={registering}
                  >
                    {registering ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.submitBtnText}>Register User</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </Modal>

        </View>
      ) : (
        /* LOGIN SCREEN (CLEAN WHITE THEME) */
        <ScrollView contentContainerStyle={styles.loginContainer}>
          <View style={styles.brandBadgeContainer}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconCircleText}>🏛</Text>
            </View>
            <Text style={styles.loginBrand}>DocVault</Text>
            <Text style={styles.loginTagline}>Enterprise Document Vault & Access</Text>
          </View>

          <View style={styles.loginCard}>
            <Text style={styles.loginCardTitle}>Sign In</Text>
            <Text style={styles.loginCardSubtitle}>Authenticate using your credentials</Text>

            <Text style={styles.fieldLabel}>Corporate Email</Text>
            <TextInput
              style={styles.loginInput}
              placeholder="ithelpdesk@plystory.com"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />

            <Text style={styles.fieldLabel}>Password</Text>
            <TextInput
              style={styles.loginInput}
              placeholder="••••••••••••"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <TouchableOpacity 
              style={styles.loginSubmitBtn} 
              onPress={handleLogin}
              disabled={authLoading}
            >
              {authLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.loginSubmitText}>Sign In & Open Vault</Text>
              )}
            </TouchableOpacity>

            {/* Quick Fill Button */}
            <TouchableOpacity style={styles.quickSuperadminBtn} onPress={fillSuperadmin}>
              <Text style={styles.quickSuperadminText}>Fill Superadmin Credentials</Text>
            </TouchableOpacity>

            {/* Server Configuration */}
            <TouchableOpacity 
              style={styles.configToggle} 
              onPress={() => setShowConfig(!showConfig)}
            >
              <Text style={styles.configToggleText}>
                {showConfig ? 'Hide Server URL Settings' : '⚙ Server URL Settings'}
              </Text>
            </TouchableOpacity>

            {showConfig && (
              <View style={styles.configBox}>
                <Text style={styles.configLabel}>Target API URL:</Text>
                <TextInput
                  style={styles.configInput}
                  value={apiUrl}
                  onChangeText={setApiUrl}
                  autoCapitalize="none"
                />
                <View style={styles.quickUrlRow}>
                  <TouchableOpacity 
                    style={styles.quickUrlPill}
                    onPress={() => setApiUrl(PRODUCTION_URL)}
                  >
                    <Text style={styles.quickUrlText}>Use Cloud Subdomain</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.quickUrlPill}
                    onPress={() => setApiUrl(LOCAL_WIFI_URL)}
                  >
                    <Text style={styles.quickUrlText}>Use Local Wi-Fi</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  mainView: {
    flex: 1,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  superadminBadge: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  superadminBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4338ca',
  },
  userBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  userBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803d',
  },
  userSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  logoutBtn: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  logoutBtnText: {
    color: '#dc2626',
    fontWeight: '700',
    fontSize: 12,
  },
  navBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 12,
  },
  navTab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  navTabActive: {
    borderBottomColor: '#4f46e5',
  },
  navTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  navTabTextActive: {
    color: '#4f46e5',
  },
  tabContent: {
    flex: 1,
    padding: 14,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  uploadBtn: {
    flex: 1,
    backgroundColor: '#4f46e5',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  uploadBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  createFolderBtn: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
    alignItems: 'center',
  },
  createFolderBtnText: {
    color: '#b45309',
    fontWeight: '700',
    fontSize: 13,
  },
  refreshBtn: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  refreshBtnText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 15,
  },
  folderSection: {
    marginBottom: 10,
  },
  folderScroll: {
    flexDirection: 'row',
  },
  folderChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
  },
  folderChipActive: {
    backgroundColor: '#eef2ff',
    borderColor: '#6366f1',
  },
  folderChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  folderChipTextActive: {
    color: '#4338ca',
  },
  folderDelBtn: {
    marginLeft: 6,
    padding: 2,
  },
  folderDelText: {
    color: '#ef4444',
    fontSize: 10,
    fontWeight: 'bold',
  },
  searchBox: {
    marginBottom: 10,
  },
  searchInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0f172a',
  },
  docCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  docHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  docTitleBlock: {
    flex: 1,
    marginRight: 8,
  },
  docName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  docMetaFilename: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  badgeGroup: {
    alignItems: 'flex-end',
  },
  docTypeBadge: {
    backgroundColor: '#f1f5f9',
    color: '#334155',
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  docDescText: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
    marginTop: 6,
  },
  renewalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  renewalLabel: {
    fontSize: 11,
    color: '#b45309',
    fontWeight: '600',
  },
  renewalValue: {
    fontSize: 11,
    color: '#92400e',
    fontWeight: '700',
  },
  docFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  docUploader: {
    fontSize: 11,
    color: '#94a3b8',
  },
  docBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  openBtn: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  openBtnText: {
    color: '#4338ca',
    fontSize: 11,
    fontWeight: '700',
  },
  deleteDocBtn: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  deleteDocText: {
    color: '#dc2626',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748b',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  userCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  userCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  userNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  userEmailText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  userPhoneText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  userRoleBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  userRoleText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
  },
  userCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
  },
  userDeptText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  statusActive: {
    fontSize: 11,
    color: '#16a34a',
    fontWeight: '700',
  },
  statusSuspended: {
    fontSize: 11,
    color: '#dc2626',
    fontWeight: '700',
  },
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
  },
  infoLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  infoKey: {
    fontSize: 12,
    color: '#64748b',
  },
  infoVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  metricText: {
    fontSize: 13,
    color: '#334155',
    marginVertical: 4,
    fontWeight: '500',
  },
  switchUrlBtn: {
    marginTop: 10,
    backgroundColor: '#e0e7ff',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  switchUrlBtnText: {
    color: '#4338ca',
    fontWeight: '700',
    fontSize: 12,
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalBox: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
  },
  scrollModalBox: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
  },
  modalHeading: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
    marginTop: 6,
    textTransform: 'uppercase',
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 8,
  },
  filePickerBox: {
    borderWidth: 2,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    marginBottom: 10,
  },
  filePickerIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  filePickerPlaceholder: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  filePickerSelected: {
    fontSize: 12,
    color: '#4338ca',
    fontWeight: '700',
  },
  typeChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  typeChip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  typeChipActive: {
    backgroundColor: '#e0e7ff',
    borderColor: '#6366f1',
  },
  typeChipText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  typeChipTextActive: {
    color: '#4338ca',
    fontWeight: '700',
  },
  modalFolderScroll: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  folderSelectChip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  folderSelectChipActive: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
  },
  folderSelectText: {
    fontSize: 11,
    color: '#475569',
  },
  folderSelectTextActive: {
    color: '#b45309',
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cancelBtnText: {
    color: '#64748b',
    fontWeight: '600',
    fontSize: 13,
  },
  submitBtn: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  submitBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  loginContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f8fafc',
  },
  brandBadgeContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  iconCircleText: {
    fontSize: 28,
  },
  loginBrand: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
  },
  loginTagline: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  loginCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  loginCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  loginCardSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 16,
  },
  loginInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0f172a',
    marginBottom: 12,
  },
  loginSubmitBtn: {
    backgroundColor: '#4f46e5',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  loginSubmitText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  quickSuperadminBtn: {
    marginTop: 14,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  quickSuperadminText: {
    color: '#4338ca',
    fontSize: 12,
    fontWeight: '700',
  },
  configToggle: {
    marginTop: 14,
    alignItems: 'center',
  },
  configToggleText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  configBox: {
    marginTop: 10,
    padding: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
  },
  configLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  configInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: '#0f172a',
    marginTop: 4,
  },
  quickUrlRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  quickUrlPill: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  quickUrlText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#334155',
  },
});
