import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Shield, ShieldCheck, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getRoleDisplayName, isSuperAdminEmail, UserRole } from "@shared/permissions";

interface UserData {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
  phone?: string | null;
  company?: string | null;
  picture?: string | null;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [pendingRole, setPendingRole] = useState<string>("");

  const { data: users = [], isLoading } = useQuery<UserData[]>({
    queryKey: ["/api/admin/users"],
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return apiRequest("PUT", `/api/admin/users/${userId}/role`, { role });
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

  const filteredUsers = users.filter((user) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      user.email.toLowerCase().includes(searchLower) ||
      (user.firstName?.toLowerCase() || "").includes(searchLower) ||
      (user.lastName?.toLowerCase() || "").includes(searchLower)
    );
  });

  const handleRoleChange = (userId: string, newRole: string) => {
    updateRoleMutation.mutate({ userId, role: newRole });
  };

  const startEditing = (user: UserData) => {
    setEditingUserId(user.id);
    setPendingRole(user.role);
  };

  const cancelEditing = () => {
    setEditingUserId(null);
    setPendingRole("");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="loading-users">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">User Management</h1>
        <p className="text-muted-foreground">Manage team member roles and permissions</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            {users.length} registered team member{users.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
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
                  <TableHead>Role</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
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
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEditing(user)}
                          disabled={isSuperAdminEmail(user.email)}
                          data-testid={`button-edit-role-${user.id}`}
                        >
                          Edit Role
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {searchQuery ? "No users match your search" : "No users found"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
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
