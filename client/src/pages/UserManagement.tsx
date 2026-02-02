import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Search, Shield, ShieldCheck, User, MoreHorizontal, UserX, UserCheck, History, Users, UserPlus, Trash2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getRoleDisplayName, INITIAL_SUPER_ADMIN_EMAILS, UserRole } from "@shared/permissions";
import { Link } from "wouter";

interface FUBUser {
  id: string;
  name: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  active: boolean;
}

interface FUBUsersData {
  users: FUBUser[];
  count: number;
}

interface FUBStatusData {
  configured: boolean;
  message?: string;
}

interface UserData {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
  phone?: string | null;
  company?: string | null;
  picture?: string | null;
  isActive?: boolean;
  createdAt?: string;
  lastLoginAt?: string | null;
}

function getRoleBadgeVariant(role: string): "default" | "secondary" | "destructive" | "outline" {
  switch (role) {
    case "super_admin":
      return "destructive";
    case "admin":
      return "default";
    default:
      return "secondary";
  }
}

function getRoleIcon(role: string) {
  switch (role) {
    case "super_admin":
      return <ShieldCheck className="w-3 h-3" />;
    case "admin":
      return <Shield className="w-3 h-3" />;
    default:
      return <User className="w-3 h-3" />;
  }
}

function UserManagementContent() {
  const { toast } = useToast();
  const { user: currentUser } = usePermissions();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [pendingRole, setPendingRole] = useState<string>("");
  const [selectedInviteRole, setSelectedInviteRole] = useState<string>("agent");
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: "disable" | "enable" | null;
    user: UserData | null;
  }>({ open: false, type: null, user: null });
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    user: UserData | null;
  }>({ open: false, user: null });

  const { data: users = [], isLoading } = useQuery<UserData[]>({
    queryKey: ["/api/admin/users"],
  });

  // Use same FUB endpoints as Leads page (proven working)
  const { data: fubStatus } = useQuery<FUBStatusData>({
    queryKey: ["/api/fub/status"],
  });

  const { data: fubUsersData } = useQuery<FUBUsersData>({
    queryKey: ["/api/fub/users"],
    enabled: fubStatus?.configured === true,
  });

  const fubUsers = fubUsersData?.users || [];
  const fubConfigured = fubStatus?.configured ?? false;

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return apiRequest(`/api/admin/users/${userId}/role`, "PUT", { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Role updated",
        description: "User role has been updated successfully.",
      });
      setEditingUserId(null);
      setPendingRole("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user role.",
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      return apiRequest(`/api/admin/users/${userId}/status`, "PUT", { isActive });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: variables.isActive ? "User enabled" : "User disabled",
        description: variables.isActive 
          ? "User can now access the platform." 
          : "User has been disabled and cannot log in.",
      });
      setConfirmDialog({ open: false, type: null, user: null });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user status.",
        variant: "destructive",
      });
      setConfirmDialog({ open: false, type: null, user: null });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (userData: { 
      email: string; 
      firstName: string; 
      lastName: string; 
      role: string 
    }) => {
      const res = await fetch('/api/admin/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(userData),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to invite user');
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      toast({ 
        title: 'User invited successfully',
        description: `${variables.email} has been added as ${getRoleDisplayName(variables.role as UserRole)}`,
      });
      setSelectedInviteRole("agent");
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fub/users'] });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Failed to invite user', 
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete user');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ 
        title: 'User deleted', 
        description: 'User has been permanently removed',
      });
      setDeleteDialog({ open: false, user: null });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Failed to delete user', 
        description: error.message,
        variant: 'destructive',
      });
      setDeleteDialog({ open: false, user: null });
    },
  });

  const { filteredUsers, unregisteredFubUsers } = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    
    const registered = users.filter((user) => {
      if (!query) return true;
      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase();
      return (
        user.email.toLowerCase().includes(query) ||
        (user.firstName?.toLowerCase() || "").includes(query) ||
        (user.lastName?.toLowerCase() || "").includes(query) ||
        fullName.includes(query)
      );
    });
    
    const registeredEmails = new Set(
      users.map((u) => u.email.toLowerCase())
    );
    
    const unregistered = fubUsers
      .filter((user) => !registeredEmails.has(user.email?.toLowerCase()))
      .filter((user) => {
        if (!query) return false;
        return (
          user.email?.toLowerCase().includes(query) ||
          user.name?.toLowerCase().includes(query) ||
          user.firstName?.toLowerCase().includes(query) ||
          user.lastName?.toLowerCase().includes(query)
        );
      });
    
    return {
      filteredUsers: registered,
      unregisteredFubUsers: unregistered,
    };
  }, [users, fubUsers, searchQuery]);

  const handleRoleChange = (userId: string, newRole: string) => {
    updateRoleMutation.mutate({ userId, role: newRole });
  };

  const handleStatusChange = (user: UserData, enable: boolean) => {
    setConfirmDialog({ 
      open: true, 
      type: enable ? "enable" : "disable", 
      user 
    });
  };

  const confirmStatusChange = () => {
    if (confirmDialog.user && confirmDialog.type) {
      updateStatusMutation.mutate({
        userId: confirmDialog.user.id,
        isActive: confirmDialog.type === "enable",
      });
    }
  };

  const startEditing = (user: UserData) => {
    setEditingUserId(user.id);
    setPendingRole(user.role);
  };

  const cancelEditing = () => {
    setEditingUserId(null);
    setPendingRole("");
  };

  const isProtectedUser = (user: UserData) => {
    return INITIAL_SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase());
  };

  const canModifyUser = (user: UserData) => {
    return !isProtectedUser(user);
  };

  const canDisableUser = (user: UserData) => {
    // Cannot disable self, Super Admins, or protected users
    if (currentUser && user.id === currentUser.id) return false;
    return user.role !== "super_admin" && !isProtectedUser(user);
  };

  const canDeleteUser = (user: UserData) => {
    // Cannot delete self, Super Admins, or protected users
    if (currentUser && user.id === currentUser.id) return false;
    return user.role !== "super_admin" && !isProtectedUser(user);
  };

  const handleDeleteUser = () => {
    if (deleteDialog.user) {
      deleteMutation.mutate(deleteDialog.user.id);
    }
  };

  const handleInvite = (fubUser: FUBUser, role: string) => {
    const nameParts = fubUser.name?.split(' ') || [];
    inviteMutation.mutate({
      email: fubUser.email,
      firstName: fubUser.firstName || nameParts[0] || '',
      lastName: fubUser.lastName || nameParts.slice(1).join(' ') || '',
      role,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="loading-users">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeCount = users.filter(u => u.isActive !== false).length;
  const disabledCount = users.filter(u => u.isActive === false).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">User Management</h1>
          <p className="text-muted-foreground">Manage team member roles and permissions</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/activity-logs">
            <Button variant="outline" className="gap-2" data-testid="button-view-activity-logs">
              <History className="h-4 w-4" />
              Activity Logs
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Users</CardDescription>
            <CardTitle className="text-3xl" data-testid="text-total-users">{users.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-3xl text-green-600" data-testid="text-active-users">{activeCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Disabled</CardDescription>
            <CardTitle className="text-3xl text-muted-foreground" data-testid="text-disabled-users">{disabledCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            Manage user accounts, roles, and access
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={fubConfigured ? "Search by name or email (includes Follow Up Boss team)..." : "Search by name or email..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-users"
              />
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow 
                    key={user.id} 
                    data-testid={`row-user-${user.id}`}
                    className={user.isActive === false ? "opacity-60" : ""}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.picture || undefined} />
                          <AvatarFallback>
                            {(user.firstName?.[0] || user.email[0]).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">
                            {user.firstName && user.lastName
                              ? `${user.firstName} ${user.lastName}`
                              : user.firstName || user.email.split("@")[0]}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.email}
                    </TableCell>
                    <TableCell>
                      {user.isActive === false ? (
                        <Badge variant="outline" className="text-muted-foreground border-muted-foreground/50">
                          <UserX className="w-3 h-3 mr-1" />
                          Disabled
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-green-600 border-green-600/50">
                          <UserCheck className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingUserId === user.id ? (
                        <Select value={pendingRole} onValueChange={setPendingRole}>
                          <SelectTrigger className="w-[140px]" data-testid={`select-role-${user.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="agent">Agent</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="super_admin">Super Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant={getRoleBadgeVariant(user.role)} className="gap-1">
                          {getRoleIcon(user.role)}
                          {getRoleDisplayName(user.role as UserRole)}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleDateString()
                        : "Never"}
                    </TableCell>
                    <TableCell className="text-right">
                      {editingUserId === user.id ? (
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            onClick={() => handleRoleChange(user.id, pendingRole)}
                            disabled={updateRoleMutation.isPending || pendingRole === user.role}
                            data-testid={`button-save-role-${user.id}`}
                          >
                            {updateRoleMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Save"
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={cancelEditing}
                            data-testid={`button-cancel-role-${user.id}`}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              size="icon" 
                              variant="ghost"
                              data-testid={`button-actions-${user.id}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => startEditing(user)}
                              disabled={!canModifyUser(user)}
                              data-testid={`menu-edit-role-${user.id}`}
                            >
                              <Shield className="h-4 w-4 mr-2" />
                              Change Role
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {user.isActive === false ? (
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(user, true)}
                                disabled={!canModifyUser(user)}
                                data-testid={`menu-enable-${user.id}`}
                              >
                                <UserCheck className="h-4 w-4 mr-2" />
                                Enable User
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(user, false)}
                                disabled={!canDisableUser(user)}
                                className="text-destructive"
                                data-testid={`menu-disable-${user.id}`}
                              >
                                <UserX className="h-4 w-4 mr-2" />
                                Disable User
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {canDeleteUser(user) ? (
                              <DropdownMenuItem
                                onClick={() => setDeleteDialog({ open: true, user })}
                                className="text-destructive"
                                data-testid={`menu-delete-${user.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Permanently
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem disabled className="text-muted-foreground text-xs">
                                Cannot delete {user.role === 'super_admin' ? 'Super Admins' : 'this user'}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredUsers.length === 0 && unregisteredFubUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {searchQuery ? "No users match your search" : "No users found"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {searchQuery && unregisteredFubUsers.length > 0 && (
        <Card className="border-2 border-dashed border-orange-300 bg-orange-50/30 dark:bg-orange-950/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
              <Users className="w-5 h-5" />
              Follow Up Boss Team Members
            </CardTitle>
            <CardDescription>
              These team members are in Follow Up Boss but haven't logged into the portal yet.
              Invite them to pre-assign their role.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {unregisteredFubUsers.map((fubUser) => (
                <div key={fubUser.id} className="flex items-center justify-between py-3" data-testid={`fub-user-${fubUser.id}`}>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                        {(fubUser.firstName?.[0] || fubUser.name?.[0] || fubUser.email[0]).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{fubUser.name || fubUser.email.split("@")[0]}</div>
                      <div className="text-sm text-muted-foreground">{fubUser.email}</div>
                    </div>
                    <Badge variant="outline" className="ml-2 text-orange-600 border-orange-300">
                      <Users className="w-3 h-3 mr-1" />
                      Not Registered
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select 
                      defaultValue="agent"
                      onValueChange={(value) => setSelectedInviteRole(value)}
                    >
                      <SelectTrigger className="w-[130px]" data-testid={`select-role-${fubUser.id}`}>
                        <SelectValue placeholder="Agent" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="agent">Agent</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      className="gap-1"
                      onClick={() => handleInvite(fubUser, selectedInviteRole || "agent")}
                      disabled={inviteMutation.isPending}
                      data-testid={`button-invite-${fubUser.id}`}
                    >
                      {inviteMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4" />
                          Invite
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Role Permissions</CardTitle>
          <CardDescription>Overview of what each role can access</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4" />
                <h3 className="font-medium">Agent</h3>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Create and edit own CMAs</li>
                <li>Create presentations</li>
                <li>Use global slides</li>
                <li>View analytics</li>
              </ul>
            </div>
            <div className="p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4" />
                <h3 className="font-medium">Admin</h3>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>All Agent permissions</li>
                <li>View presentation library</li>
                <li>Create templates</li>
                <li>Manage display settings</li>
              </ul>
            </div>
            <div className="p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-4 h-4" />
                <h3 className="font-medium">Super Admin</h3>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>All Admin permissions</li>
                <li>Manage presentation library</li>
                <li>Manage user roles</li>
                <li>Manage templates</li>
                <li>Manage company settings</li>
                <li>Enable/disable users</li>
                <li>View activity logs</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog({ open: false, type: null, user: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.type === "disable" ? "Disable User Account" : "Enable User Account"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.type === "disable" ? (
                <>
                  Are you sure you want to disable <strong>{confirmDialog.user?.email}</strong>?
                  They will not be able to log in until their account is re-enabled.
                </>
              ) : (
                <>
                  Are you sure you want to enable <strong>{confirmDialog.user?.email}</strong>?
                  They will be able to log in and access the platform again.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-status">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmStatusChange}
              className={confirmDialog.type === "disable" ? "bg-destructive text-destructive-foreground" : ""}
              data-testid="button-confirm-status"
            >
              {updateStatusMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : confirmDialog.type === "disable" ? (
                "Disable"
              ) : (
                "Enable"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, user: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete User Permanently
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Are you sure you want to permanently delete{' '}
                <strong>{deleteDialog.user?.firstName} {deleteDialog.user?.lastName}</strong> ({deleteDialog.user?.email})?
              </p>
              <p className="text-destructive font-medium">
                This action cannot be undone. All user data will be permanently removed.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete Permanently"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function UserManagement() {
  return (
    <ProtectedRoute minimumRole="super_admin" fallbackPath="/admin">
      <UserManagementContent />
    </ProtectedRoute>
  );
}
